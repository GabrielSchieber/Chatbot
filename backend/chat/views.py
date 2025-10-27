import json
from typing import Any

from django.contrib.auth import authenticate
from django.core.validators import validate_email
from django.db.models import Prefetch, Q
from django.shortcuts import render
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import ChatSerializer, GetChatsGETSerializer, MessageSerializer, UserSerializer
from .models import Chat, Message, MessageFile, PreAuthToken, User
from .tasks import generate_pending_message_in_chat, is_any_user_chat_pending, stop_pending_chat, stop_user_pending_chats
from .throttles import IPEmailRateThrottle, RefreshRateThrottle, SignupRateThrottle

class Signup(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request: Request):
        email = request.data.get("email")
        password = request.data.get("password")

        if email is None or password is None:
            return Response({"error": "Both 'email' and 'password' fields must be provided."}, status.HTTP_400_BAD_REQUEST)

        try:
            validate_email(email)
        except:
            return Response({"error": "Email is not valid."}, status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email = email).exists():
            return Response({"error": "Email is already registered. Please choose another one."}, status.HTTP_400_BAD_REQUEST)

        if len(password) < 12 or len(password) > 100:
            return Response({"error": "Password must have between 12 and 100 characters."}, status.HTTP_400_BAD_REQUEST)

        User.objects.create(email = email, password = password)

        return Response(status = status.HTTP_201_CREATED)

class Login(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        email = request.data.get("email")
        password = request.data.get("password")

        if email is None or password is None:
            return Response({"error": "Both 'email' and 'password' fields must be provided."}, status.HTTP_400_BAD_REQUEST)

        user: User | None = authenticate(request, email = email, password = password)
        if user is None:
            return Response({"error": "Email and/or password are invalid."}, status.HTTP_400_BAD_REQUEST)

        if user.mfa.is_enabled:
            pre_auth_token = PreAuthToken.objects.create(user = user)
            return Response({"token": str(pre_auth_token.token)}, status.HTTP_200_OK)
        else:
            refresh = RefreshToken.for_user(user)
            response = Response(status = status.HTTP_200_OK)
            response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
            response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")
            return response

class VerifyMFA(APIView):
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        token = request.data.get("token")
        code = request.data.get("code")

        if token is None or code is None:
            return Response({"error": "Both 'token' and 'code' fields must be provided."}, status.HTTP_400_BAD_REQUEST)            

        try:
            pre_auth_token = PreAuthToken.objects.get(token = token)
        except PreAuthToken.DoesNotExist:
            return Response({"error": "Invalid or expired token."}, status.HTTP_401_UNAUTHORIZED)

        if pre_auth_token.is_expired():
            pre_auth_token.delete()
            return Response({"error": "Token expired."}, status.HTTP_401_UNAUTHORIZED)

        if pre_auth_token.user.mfa.verify(code):
            refresh = RefreshToken.for_user(pre_auth_token.user)
            response = Response(status = status.HTTP_200_OK)
            response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
            response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")
            pre_auth_token.delete()
            return response
        else:
            return Response({"error": "Invalid code."}, status.HTTP_401_UNAUTHORIZED)

class Logout(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        response = Response(status = status.HTTP_200_OK)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class Refresh(TokenRefreshView):
    throttle_classes = [RefreshRateThrottle]

    def post(self, request: Request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"error": "'refresh_token' field must be provided."}, status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data = {"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception = True)
        except Exception:
            return Response({"error": "Invalid refresh token."}, status.HTTP_401_UNAUTHORIZED)

        access = serializer.validated_data["access"]
        new_refresh = serializer.validated_data.get("refresh")

        response = Response(status = status.HTTP_200_OK)
        response.set_cookie("access_token", access, httponly = True, samesite = "Lax")
        if new_refresh:
            response.set_cookie("refresh_token", new_refresh, httponly = True, samesite = "Lax")
        return response

class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        return Response(UserSerializer(request.user, many = False).data, status.HTTP_200_OK)

    def patch(self, request: Request):
        user: User = request.user

        theme = request.data.get("theme")
        if theme != None: 
            if theme not in ["System", "Light", "Dark"]:
                return Response({"error": "Invalid theme."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.theme = theme

        has_sidebar_open = request.data.get("has_sidebar_open")
        if has_sidebar_open != None:
            if type(has_sidebar_open) != bool:
                return Response({"error": "Invalid data type for 'has_sidebar_open' field."}, status.HTTP_400_BAD_REQUEST)
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
            return Response({"backup_codes": backup_codes}, status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid code."}, status.HTTP_400_BAD_REQUEST)

class DisableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user
        code = request.data.get("code")

        if not user.mfa.is_enabled:
            return Response({"error": "MFA is not enabled."}, status.HTTP_400_BAD_REQUEST)

        if user.mfa.verify(code):
            user.mfa.disable()
            return Response(status = status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid code."}, status.HTTP_400_BAD_REQUEST)

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        try:
            request.user.delete()
            return Response(status = status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response({"error": "Failed to delete account."}, status.HTTP_400_BAD_REQUEST)

class GetChat(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        chat_uuid = request.GET.get("chat_uuid")

        if chat_uuid is None:
            return Response("'chat_uuid' field must be provided.")

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response(status = status.HTTP_400_BAD_REQUEST)

        return Response(ChatSerializer(chat, many = False).data, status.HTTP_200_OK)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        query_serializer = GetChatsGETSerializer(data = request.GET)
        query_serializer.is_valid(raise_exception = True)
        data: dict[str, Any] = query_serializer.validated_data

        offset = data["offset"]
        limit = data["limit"]
        pending = data["pending"]
        archived = data["archived"]

        chats = Chat.objects.filter(user = request.user, is_archived = archived)
        if pending:
            chats = chats.exclude(pending_message = None)
        chats = chats.order_by("-created_at")

        serializer = ChatSerializer(chats[offset:offset + limit], many = True)
        return Response({"chats": serializer.data, "has_more": offset + limit < chats.count()}, status.HTTP_200_OK)

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        search = request.GET.get("search", "")
        limit = int(request.GET.get("limit", 20))
        offset = int(request.GET.get("offset", 0))

        matched_messages = Message.objects.filter(chat__user = request.user, text__icontains = search).order_by("created_at")

        chats = Chat.objects.filter(user = request.user).filter(
            Q(title__icontains = search) | Q(messages__text__icontains = search)
        ).distinct().order_by("-created_at")

        total = chats.count()
        chats = chats[offset:offset + limit]

        chats = chats.prefetch_related(Prefetch("messages", queryset = matched_messages, to_attr = "matched_messages"))

        entries = [{
            "uuid": chat.uuid,
            "title": chat.title,
            "is_archived": chat.is_archived,
            "matches": [m.text for m in getattr(chat, "matched_messages", [])],
            "last_modified_at": chat.last_modified_at()
        } for chat in chats]

        return Response({"entries": entries, "has_more": offset + limit < total}, status.HTTP_200_OK)

class RenameChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")
        new_title = request.data.get("new_title")

        if chat_uuid is None or new_title is None:
            return Response({"error": "Both 'chat_uuid' and 'new_title' fields must be provided."}, status.HTTP_400_BAD_REQUEST)

        chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
        if chat is None:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        chat.title = new_title
        chat.save()
        return Response(status = status.HTTP_200_OK)

class ArchiveChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")

        if chat_uuid is None:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
        if chat is None:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        stop_pending_chat(chat)
        chat.is_archived = True
        chat.save()
        return Response(status = status.HTTP_200_OK)

class UnarchiveChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")

        if chat_uuid is None:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
        if chat is None:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        stop_pending_chat(chat)
        chat.is_archived = False
        chat.save()
        return Response(status = status.HTTP_200_OK)

class DeleteChat(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")

        if chat_uuid is None:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_404_NOT_FOUND)

        chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
        if chat is None:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        stop_pending_chat(chat)
        chat.delete()
        return Response(status = status.HTTP_204_NO_CONTENT)

class ArchiveChats(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).update(is_archived = True)
        return Response(status = status.HTTP_200_OK)

class UnarchiveChats(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).update(is_archived = False)
        return Response(status = status.HTTP_200_OK)

class DeleteChats(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).delete()
        return Response(status = status.HTTP_204_NO_CONTENT)

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
        if chat_uuid is None:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        message_file_id = request.GET.get("message_file_id")
        if message_file_id is None:
            return Response({"error": "'message_file_id' field must be provided."}, status.HTTP_400_BAD_REQUEST)
        message_file_id = int(message_file_id)

        chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
        if chat is None:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        message_file = MessageFile.objects.filter(message__chat = chat, id = message_file_id).first()

        if message_file is not None:
            return Response(message_file.content, status.HTTP_200_OK, content_type = message_file.content_type)
        else:
            return Response({"error": "File was not found."}, status.HTTP_404_NOT_FOUND)

class GetMessages(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        chat_uuid = request.GET.get("chat_uuid")
        if not chat_uuid:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

        messages = Message.objects.filter(chat = chat).order_by("created_at").prefetch_related("files")
        serializer = MessageSerializer(messages, many = True)
        return Response(serializer.data, status.HTTP_200_OK)

class NewMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid", "")
        if type(chat_uuid) == str:
            if chat_uuid == "":
                chat = Chat.objects.create(user = request.user, title = f"Chat {Chat.objects.filter(user = request.user).count() + 1}")
            else:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Invalid data type for 'chat_uuid' field."}, status.HTTP_400_BAD_REQUEST)

        text = request.data.get("text", "")
        if type(text) != str:
            return Response({"error": "Invalid data type for 'text' field."}, status.HTTP_400_BAD_REQUEST)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for 'model' field."}, status.HTTP_400_BAD_REQUEST)
        if model not in [c[0] for c in Message._meta.get_field("model").choices]:
            return Response({"error": "Invalid model."}, status.HTTP_400_BAD_REQUEST)

        files = request.FILES.getlist("files")
        if type(files) != list:
            return Response({"error": "Invalid data type for 'files'."}, status.HTTP_400_BAD_REQUEST)

        total_size = 0
        for file in files:
            total_size += file.size
        if total_size > 5_000_000:
            return Response({"error": "Total file size exceeds limit of 5 MB."}, status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)
            else:
                return Response({"error": "Invalid data type for 'chat_uuid' field."}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "A valid chat UUID must be provided."}, status.HTTP_400_BAD_REQUEST)

        text = request.data.get("text", "")
        if type(text) != str:
            return Response({"error": "Invalid data type for 'text' field."}, status.HTTP_400_BAD_REQUEST)

        index = request.data.get("index")
        if not index:
            return Response({"error": "Index field must be provided."}, status.HTTP_400_BAD_REQUEST)
        index = int(index)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for 'model' field."}, status.HTTP_400_BAD_REQUEST)
        if model not in [c[0] for c in Message._meta.get_field("model").choices]:
            return Response({"error": "Invalid model."}, status.HTTP_400_BAD_REQUEST)

        added_files = request.FILES.getlist("added_files")
        if type(added_files) != list:
            return Response({"error": "Invalid data type for 'added_files' field."}, status.HTTP_400_BAD_REQUEST)

        removed_file_ids = json.loads(request.data.get("removed_file_ids", []))
        if type(removed_file_ids) != list:
            return Response({"error": "Invalid data type for 'removed_files_ids' field."}, status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": "Total file size exceeds limit of 5 MB."}, status.HTTP_400_BAD_REQUEST)

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
            return Response({"error": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)
            else:
                return Response({"error": "Invalid data type for 'chat_uuid'."}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "A valid chat UUID must be provided."}, status.HTTP_400_BAD_REQUEST)

        index = request.data.get("index")
        if not index:
            return Response({"error": "Index is must be provided."}, status.HTTP_400_BAD_REQUEST)
        index = int(index)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for 'model' field."}, status.HTTP_400_BAD_REQUEST)
        if model not in [c[0] for c in Message._meta.get_field("model").choices]:
            return Response({"error": "Invalid model."}, status.HTTP_400_BAD_REQUEST)

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