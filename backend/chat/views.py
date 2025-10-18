import json
from datetime import timedelta

from django.contrib.auth import authenticate
from django.db.models import Prefetch, Q
from django.shortcuts import render
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import ChatSerializer, MessageSerializer, RegisterSerializer, UserSerializer
from .models import Chat, Message, MessageFile, PreAuthToken, User
from .tasks import generate_pending_message_in_chat, is_any_user_chat_pending, stop_pending_chat, stop_user_pending_chats

class Signup(generics.CreateAPIView):
    queryset = User.objects.all()
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

class Login(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request):
        email = request.data.get("email")
        password = request.data.get("password")

        user: User | None = authenticate(request, email = email, password = password)
        if user is not None:
            if user.mfa.is_enabled:
                pre = PreAuthToken.objects.create(user = user)
                return Response({"is_mfa_required": True, "pre_auth_token": str(pre.token)}, status.HTTP_200_OK)
            else:
                refresh = RefreshToken.for_user(user)
                response = Response({"success": True}, status.HTTP_200_OK)
                response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
                response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")
                return response
        else:
            return Response({"error": "Invalid credentials"}, status.HTTP_400_BAD_REQUEST)

class VerifyMFA(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request):
        token = request.data.get("pre_auth_token")
        code = request.data.get("code")

        try:
            pre_auth_token = PreAuthToken.objects.get(token = token)
        except PreAuthToken.DoesNotExist:
            return Response({"error": "Invalid or expired pre auth token"}, status.HTTP_401_UNAUTHORIZED)

        if pre_auth_token.is_expired():
            pre_auth_token.delete()
            return Response({"error": "Pre auth token expired"}, status.HTTP_401_UNAUTHORIZED)

        user: User = pre_auth_token.user

        if user.mfa.verify(code):
            refresh = RefreshToken.for_user(user)
            response = Response({"success": True}, status.HTTP_200_OK)
            response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
            response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")
            pre_auth_token.delete()
            return response
        else:
            return Response({"error": "Invalid MFA code"}, status.HTTP_401_UNAUTHORIZED)

class Logout(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        response = Response({"success": True}, status.HTTP_200_OK)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class Refresh(TokenRefreshView):
    def post(self, request: Request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"error": "No refresh token"}, status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data = {"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception = True)
        except Exception:
            return Response({"error": "Invalid refresh token"}, status.HTTP_401_UNAUTHORIZED)

        access = serializer.validated_data["access"]
        new_refresh = serializer.validated_data.get("refresh")

        response = Response({"success": True}, status.HTTP_200_OK)
        response.set_cookie("access_token", access, httponly = True, samesite = "Lax")
        if new_refresh:
            response.set_cookie("refresh_token", new_refresh, httponly = True, samesite = "Lax")
        return response

class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        return Response(UserSerializer(request.user, many = False).data)

    def patch(self, request: Request):
        user: User = request.user

        theme = request.data.get("theme")
        if theme != None: 
            if theme not in ["System", "Light", "Dark"]:
                return Response({"error": "Invalid theme"}, status.HTTP_400_BAD_REQUEST)
            user.preferences.theme = theme

        has_sidebar_open = request.data.get("has_sidebar_open")
        if has_sidebar_open != None:
            if type(has_sidebar_open) != bool:
                return Response({"error": "Invalid data type for has_sidebar_open"}, status.HTTP_400_BAD_REQUEST)
            user.preferences.has_sidebar_open = has_sidebar_open

        user.preferences.save()
        return Response(status = status.HTTP_200_OK)

class SetupMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        secret, auth_url = request.user.mfa.setup()
        return Response({"auth_url": auth_url, "secret": secret})

class EnableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user
        code = request.data.get("code")

        if user.mfa.verify(code):
            backup_codes = user.mfa.enable()
            return Response({"success": True, "backup_codes": backup_codes}, status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid code"}, status.HTTP_400_BAD_REQUEST)

class DisableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user
        code = request.data.get("code")

        if not user.mfa.is_enabled:
            return Response({"error": "MFA is not enabled"}, status.HTTP_400_BAD_REQUEST)

        if user.mfa.verify(code):
            user.mfa.disable()
            return Response({"success": True}, status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid code"}, status.HTTP_400_BAD_REQUEST)

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        try:
            request.user.delete()
            return Response(status = status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response({"error": "Failed to delete account"}, status.HTTP_400_BAD_REQUEST)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        pending = bool(request.GET.get("pending", False))
        if pending:
            chats = Chat.objects.filter(user = request.user).exclude(pending_message = None).order_by("created_at")
            serializer = ChatSerializer(chats, many = True)
            return Response(serializer.data, status.HTTP_200_OK)
        
        archived = bool(request.GET.get("archived", False))

        limit = int(request.GET.get("limit", 20))
        offset = int(request.GET.get("offset", 0))

        chats = Chat.objects.filter(user = request.user, is_archived = archived).order_by("-created_at")
        total = chats.count()
        chats = chats[offset:offset + limit]

        serializer = ChatSerializer(chats, many = True)
        return Response({"chats": serializer.data, "has_more": offset + limit < total}, status.HTTP_200_OK)

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        search = request.GET.get("search", "")
        limit = int(request.GET.get("limit", 20))
        offset = int(request.GET.get("offset", 0))

        matched_messages = Message.objects.filter(text__icontains = search).order_by("created_at")

        chats = Chat.objects.filter(user = request.user).filter(
            Q(title__icontains = search) | Q(messages__text__icontains = search)
        ).distinct().order_by("-created_at")

        total = chats.count()
        chats = chats[offset:offset + limit]

        chats = chats.prefetch_related(Prefetch("messages", queryset = matched_messages, to_attr = "matched_messages"))

        def format_month(month: int) -> str:
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            return months[month - 1]

        def get_last_modified_at(chat: Chat):
            message = Message.objects.filter(chat = chat).order_by("-last_modified_at").first()
            last_modified_at = timezone.now() - message.created_at
            if last_modified_at < timedelta(days = 1):
                return "Today"
            elif last_modified_at < timedelta(days = 2):
                return "Yesterday"
            else:
                return f"{message.created_at.day} {format_month(message.created_at.month)}"

        entries = [{
            "uuid": chat.uuid,
            "title": chat.title,
            "matches": [m.text for m in getattr(chat, "matched_messages", [])],
            "last_modified_at": get_last_modified_at(chat)
        } for chat in chats]

        return Response({"entries": entries, "has_more": offset + limit < total}, status.HTTP_200_OK)

class RenameChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        try:
            chat_uuid = request.data.get("chat_uuid")
            new_title = request.data.get("new_title")

            if not chat_uuid or not new_title:
                return Response({"error": "'chat_uuid' and 'new_title' fields are required"}, status.HTTP_400_BAD_REQUEST)

            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            chat.title = new_title
            chat.save()
            return Response(status = status.HTTP_200_OK)
        except Chat.DoesNotExist:
            return Response({"error": "Chat not found"}, status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response(status = status.HTTP_400_BAD_REQUEST)

class ArchiveOrUnarchiveChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        try:
            chat_uuid = request.data.get("chat_uuid")
            value = bool(request.data.get("value"))

            if chat_uuid is None or value is None:
                return Response({"error": "'chat_uuid' and 'value' fields are required"}, status.HTTP_400_BAD_REQUEST)

            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            stop_pending_chat(chat)
            chat.is_archived = value
            chat.save()
            return Response(status = status.HTTP_200_OK)
        except Chat.DoesNotExist:
            return Response({"error": "Chat not found"}, status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response(status = status.HTTP_400_BAD_REQUEST)

class DeleteChat(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")
        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            stop_pending_chat(chat)
            chat.delete()
            return Response(status = status.HTTP_204_NO_CONTENT)
        except Chat.DoesNotExist:
            return Response({"error": "Chat not found"}, status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response(status = status.HTTP_400_BAD_REQUEST)

class ArchiveChats(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        try:
            stop_user_pending_chats(request.user)
            Chat.objects.filter(user = request.user).update(is_archived = True)
            return Response(status = status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response(status = status.HTTP_400_BAD_REQUEST)

class DeleteChats(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        try:
            stop_user_pending_chats(request.user)
            Chat.objects.filter(user = request.user).delete()
            return Response(status = status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response(status = status.HTTP_400_BAD_REQUEST)

class StopPendingChats(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        return Response(status = status.HTTP_200_OK)

class BinaryFileRenderer(BaseRenderer):
    media_type = "application/octet-stream"
    format = None
    charset = None
    render_style = "binary"

    def render(self, data, media_type = None, renderer_context = None):
        return data

class GetMessageFileContent(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [BinaryFileRenderer]

    def get(self, request: Request):
        chat_uuid = request.GET.get("chat_uuid")
        if not chat_uuid:
            return Response({"error": "'chat_uuid' is required"}, status.HTTP_400_BAD_REQUEST)

        message_file_id = request.GET.get("message_file_id")
        if not message_file_id:
            return Response({"error": "'message_file_id' is required"}, status.HTTP_400_BAD_REQUEST)
        message_file_id = int(message_file_id)

        chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
        if not chat:
            return Response({"error": "Chat was not found"}, status.HTTP_404_NOT_FOUND)

        message_file = MessageFile.objects.filter(message__chat = chat, id = message_file_id).first()

        if message_file:
            return Response(message_file.content, status.HTTP_200_OK, content_type = message_file.content_type)
        else:
            return Response({"error": "File was not found"}, status.HTTP_404_NOT_FOUND)

class GetMessages(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        chat_uuid = request.GET.get("chat_uuid")
        if not chat_uuid:
            return Response({"error": "'chat_uuid' is required"}, status.HTTP_400_BAD_REQUEST)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found"}, status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"error": "Invalid chat UUID"}, status.HTTP_400_BAD_REQUEST)

        messages = Message.objects.filter(chat = chat).order_by("created_at").prefetch_related("files")
        serializer = MessageSerializer(messages, many = True)
        return Response(serializer.data, status.HTTP_200_OK)

class NewMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending"}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid", "")
        if type(chat_uuid) == str:
            if chat_uuid == "":
                chat = Chat.objects.create(user = request.user, title = f"Chat {Chat.objects.filter(user = request.user).count() + 1}")
            else:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Invalid data type for chat UUID"}, status.HTTP_400_BAD_REQUEST)

        text = request.data.get("text", "")
        if type(text) != str:
            return Response({"error": "Invalid data type for message"}, status.HTTP_400_BAD_REQUEST)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, status.HTTP_400_BAD_REQUEST)
        if model not in [c[0] for c in Message._meta.get_field("model").choices]:
            return Response({"error": "Invalid model"}, status.HTTP_400_BAD_REQUEST)

        files = request.FILES.getlist("files")
        if type(files) != list:
            return Response({"error": "Invalid data type for files"}, status.HTTP_400_BAD_REQUEST)

        total_size = 0
        for file in files:
            total_size += file.size
        if total_size > 5_000_000:
            return Response({"error": "Total file size exceeds limit of 5 MB"}, status.HTTP_400_BAD_REQUEST)

        user_message = Message.objects.create(chat = chat, text = text, is_from_user = True)
        if len(files) > 0:
            MessageFile.objects.bulk_create(
                [MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type) for file in files]
            )
        bot_message = Message.objects.create(chat = chat, text = "", is_from_user = False, model = model)

        chat.pending_message = bot_message
        chat.save()

        generate_pending_message_in_chat(chat)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)

class EditMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def patch(self, request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending"}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, status.HTTP_400_BAD_REQUEST)
            else:
                return Response({"error": "Invalid data type for chat UUID"}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "A valid chat UUID is required"}, status.HTTP_400_BAD_REQUEST)

        text = request.data.get("text", "")
        if type(text) != str:
            return Response({"error": "Invalid data type for message"}, status.HTTP_400_BAD_REQUEST)

        index = request.data.get("index")
        if not index:
            return Response({"error": "Index is required"}, status.HTTP_400_BAD_REQUEST)
        index = int(index)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, status.HTTP_400_BAD_REQUEST)
        if model not in [c[0] for c in Message._meta.get_field("model").choices]:
            return Response({"error": "Invalid model"}, status.HTTP_400_BAD_REQUEST)

        added_files = request.FILES.getlist("added_files")
        if type(added_files) != list:
            return Response({"error": "Invalid data type for added files"}, status.HTTP_400_BAD_REQUEST)

        removed_file_ids = json.loads(request.data.get("removed_file_ids", []))
        if type(removed_file_ids) != list:
            return Response({"error": "Invalid data type for removed files ids"}, status.HTTP_400_BAD_REQUEST)

        messages = Message.objects.filter(chat = chat).order_by("created_at")
        user_message = messages[index]

        removed_files: list[MessageFile] = []
        for removed_file_id in removed_file_ids:
            removed_message_file = MessageFile.objects.filter(message = user_message, id = removed_file_id).first()
            if removed_message_file:
                removed_files.append(removed_message_file)

        total_size = 0
        for file in added_files:
            total_size += file.size
        for file in removed_files:
            total_size -= len(file.content)
        if total_size > 5_000_000:
            return Response({"error": "Total file size exceeds limit of 5 MB"}, status.HTTP_400_BAD_REQUEST)

        bot_message = messages[index + 1]

        user_message.text = text
        for removed_file in removed_files:
            removed_file.delete()
        MessageFile.objects.bulk_create(
            [MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type) for file in added_files]
        )
        user_message.last_modified_at = timezone.now()
        user_message.save()

        bot_message.text = ""
        bot_message.model = model
        bot_message.last_modified_at = timezone.now()
        bot_message.save()

        chat.pending_message = bot_message
        chat.save()

        generate_pending_message_in_chat(chat)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)

class RegenerateMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def patch(self, request: Request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending"}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, status.HTTP_400_BAD_REQUEST)
            else:
                return Response({"error": "Invalid data type for chat UUID"}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "A valid chat UUID is required"}, status.HTTP_400_BAD_REQUEST)

        text = request.data.get("text", "")
        if type(text) != str:
            return Response({"error": "Invalid data type for message"}, status.HTTP_400_BAD_REQUEST)

        index = request.data.get("index")
        if not index:
            return Response({"error": "Index is required"}, status.HTTP_400_BAD_REQUEST)
        index = int(index)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, status.HTTP_400_BAD_REQUEST)
        if model not in [c[0] for c in Message._meta.get_field("model").choices]:
            return Response({"error": "Invalid model"}, status.HTTP_400_BAD_REQUEST)

        bot_message = Message.objects.filter(chat = chat).order_by("created_at")[index]

        bot_message.text = ""
        bot_message.model = model
        bot_message.last_modified_at = timezone.now()
        bot_message.save()

        chat.pending_message = bot_message
        chat.save()

        generate_pending_message_in_chat(chat, True)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)

def index(request):
    return render(request, "index.html")