import json

from django.contrib.auth import authenticate
from django.core.validators import validate_email
from django.db.models import Prefetch, Q
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

from .serializers import ChatSerializer, MessageSerializer, UserSerializer
from .models import Chat, Message, MessageFile, PreAuthToken, User, UserPreferences, UserSession
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
            return Response({"error": "Email address is invalid."}, status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email = email).exists():
            return Response({"error": "signup.emailError"}, status.HTTP_400_BAD_REQUEST)

        if len(password) < 12 or len(password) > 1000:
            return Response({"error": "Password must have between 12 and 1000 characters."}, status.HTTP_400_BAD_REQUEST)

        User.objects.create_user(email = email, password = password)

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
            return Response({"error": "login.error"}, status.HTTP_401_UNAUTHORIZED)

        if user.mfa.is_enabled:
            pre_auth_token = PreAuthToken.objects.create(user = user)
            return Response({"token": str(pre_auth_token.token)}, status.HTTP_200_OK)
        else:
            refresh = RefreshToken.for_user(user)

            refresh_jti = refresh.get("jti")
            UserSession.objects.create(
                user = user,
                ip_address = request.ip_address,
                user_agent = request.user_agent_raw,
                device = request.device,
                browser = request.browser,
                os = request.os,
                refresh_jti = refresh_jti
            )

            response = Response(status = status.HTTP_200_OK)
            response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
            response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")

            user.last_login = timezone.now()
            user.save(update_fields = ["last_login"])

            return response

class VerifyMFA(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        token = request.data.get("token")
        code = request.data.get("code")

        if token is None or code is None:
            return Response({"error": "Both 'token' and 'code' fields must be provided."}, status.HTTP_400_BAD_REQUEST)            

        try:
            pre_auth_token = PreAuthToken.objects.get(token = token)
        except PreAuthToken.DoesNotExist:
            return Response({"error": "mfa.messages.errorInvalidOrExpiredCode"}, status.HTTP_401_UNAUTHORIZED)
        except:
            return Response({"error": "Invalid token format."}, status.HTTP_400_BAD_REQUEST)

        if pre_auth_token.is_expired():
            pre_auth_token.delete()
            return Response({"error": "mfa.messages.errorInvalidOrExpiredCode"}, status.HTTP_401_UNAUTHORIZED)

        user = pre_auth_token.user
        if not user.mfa.verify(code):
            return Response({"error": "mfa.messages.errorInvalidCode"}, status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)

        refresh_jti = refresh.get("jti")
        UserSession.objects.create(
            user = user,
            ip_address = request.ip_address,
            user_agent = request.user_agent_raw,
            device = request.device,
            browser = request.browser,
            os = request.os,
            refresh_jti = refresh_jti
        )

        response = Response(status = status.HTTP_200_OK)
        response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
        response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")

        pre_auth_token.delete()

        user.last_login = timezone.now()
        user.save(update_fields = ["last_login"])

        return response

class Logout(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        refresh_token = request.COOKIES.get("refresh_token")
        if refresh_token:
            try:
                refresh = RefreshToken(refresh_token)
                jti = refresh.get("jti")
                UserSession.objects.filter(refresh_jti = jti, logout_at__isnull = True).update(logout_at = timezone.now())
            except:
                pass

        response = Response(status = status.HTTP_200_OK)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class Refresh(TokenRefreshView):
    authentication_classes = []
    throttle_classes = [RefreshRateThrottle]

    def post(self, request: Request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"error": "'refresh_token' field must be provided."}, status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data = {"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception = True)
        except:
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

        language = request.data.get("language")
        if language is not None: 
            if language not in [c[0] for c in UserPreferences._meta.get_field("language").choices]:
                return Response({"error": "Invalid language."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.language = language

        theme = request.data.get("theme")
        if theme is not None: 
            if theme not in [c[0] for c in UserPreferences._meta.get_field("theme").choices]:
                return Response({"error": "Invalid theme."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.theme = theme

        has_sidebar_open = request.data.get("has_sidebar_open")
        if has_sidebar_open is not None:
            if type(has_sidebar_open) != bool:
                return Response({"error": "Invalid data type for 'has_sidebar_open' field."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.has_sidebar_open = has_sidebar_open

        custom_instructions = request.data.get("custom_instructions")
        if custom_instructions is not None:
            if type(custom_instructions) != str:
                return Response({"error": "Invalid data type for 'custom_instructions' field."}, status.HTTP_400_BAD_REQUEST)
            if len(custom_instructions) > UserPreferences._meta.get_field("custom_instructions").max_length:
                return Response({"error": "Invalid length for 'custom_instructions' field."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.custom_instructions = custom_instructions

        nickname = request.data.get("nickname")
        if nickname is not None:
            if type(nickname) != str:
                return Response({"error": "Invalid data type for 'nickname' field."}, status.HTTP_400_BAD_REQUEST)
            if len(nickname) > UserPreferences._meta.get_field("nickname").max_length:
                return Response({"error": "Invalid length for 'nickname' field."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.nickname = nickname

        occupation = request.data.get("occupation")
        if occupation is not None:
            if type(occupation) != str:
                return Response({"error": "Invalid data type for 'occupation' field."}, status.HTTP_400_BAD_REQUEST)
            if len(occupation) > UserPreferences._meta.get_field("occupation").max_length:
                return Response({"error": "Invalid length for 'occupation' field."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.occupation = occupation

        about = request.data.get("about")
        if about is not None:
            if type(about) != str:
                return Response({"error": "Invalid data type for 'about' field."}, status.HTTP_400_BAD_REQUEST)
            if len(about) > UserPreferences._meta.get_field("about").max_length:
                return Response({"error": "Invalid length for 'about' field."}, status.HTTP_400_BAD_REQUEST)
            user.preferences.about = about

        user.preferences.save()
        return Response(status = status.HTTP_200_OK)

class SetupMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        secret, auth_url = request.user.mfa.setup()
        return Response({"auth_url": auth_url, "secret": secret}, status.HTTP_200_OK)

class EnableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user
        code = request.data.get("code")

        if not user.mfa.verify(code):
            return Response({"error": "mfa.messages.errorInvalidCode"}, status.HTTP_403_FORBIDDEN)

        backup_codes = user.mfa.enable()
        return Response({"backup_codes": backup_codes}, status.HTTP_200_OK)

class DisableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user

        if not user.mfa.is_enabled:
            return Response({"error": "MFA is not enabled."}, status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code")

        if not user.mfa.verify(code):
            return Response({"error": "mfa.messages.errorInvalidCode"}, status.HTTP_403_FORBIDDEN)

        user.mfa.disable()
        return Response(status = status.HTTP_200_OK)

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        user: User = request.user

        password = request.data.get("password")
        mfa_code = request.data.get("mfa_code")

        if password is None:
            return Response({"error": "'password' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        if not user.check_password(password):
            return Response({"error": "mfa.messages.errorInvalidPassword"}, status.HTTP_403_FORBIDDEN)

        if user.mfa.is_enabled:
            if mfa_code is None:
                return Response({"error": "MFA code is required."}, status.HTTP_400_BAD_REQUEST)
            if not user.mfa.verify(mfa_code):
                return Response({"error": "mfa.messages.errorInvalidCode"}, status.HTTP_403_FORBIDDEN)

        user.delete()
        response = Response(status = status.HTTP_204_NO_CONTENT)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class GetChat(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        chat_uuid = request.query_params.get("chat_uuid")

        if chat_uuid is None:
            return Response("'chat_uuid' field must be provided.")

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

        return Response(ChatSerializer(chat, many = False).data, status.HTTP_200_OK)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        offset = int(request.query_params.get("offset", 0))
        limit = int(request.query_params.get("limit", 20))
        pending = request.query_params.get("pending", False) == "true"
        archived = request.query_params.get("archived", False) == "true"

        chats = Chat.objects.filter(user = request.user, is_archived = archived)
        if pending:
            chats = chats.exclude(pending_message = None)
        chats = chats.order_by("-created_at")

        serializer = ChatSerializer(chats[offset:offset + limit], many = True)
        return Response({"chats": serializer.data, "has_more": offset + limit < chats.count()}, status.HTTP_200_OK)

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        search = request.query_params.get("search", "")
        offset = int(request.query_params.get("offset", 0))
        limit = int(request.query_params.get("limit", 20))

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
            "last_modified_at": chat.last_modified_at().isoformat()
        } for chat in chats]

        return Response({"entries": entries, "has_more": offset + limit < total}, status.HTTP_200_OK)

class RenameChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")
        new_title = request.data.get("new_title")

        if chat_uuid is None or new_title is None:
            return Response({"error": "Both 'chat_uuid' and 'new_title' fields must be provided."}, status.HTTP_400_BAD_REQUEST)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

        chat.title = new_title
        chat.save()
        return Response(status = status.HTTP_200_OK)

class ArchiveChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        chat_uuid = request.data.get("chat_uuid")

        if chat_uuid is None:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

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

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

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

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

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
        chat_uuid = request.query_params.get("chat_uuid")
        if chat_uuid is None:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        message_file_id = request.query_params.get("message_file_id")
        if message_file_id is None:
            return Response({"error": "'message_file_id' field must be provided."}, status.HTTP_400_BAD_REQUEST)
        message_file_id = int(message_file_id)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
            return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)

        message_file = MessageFile.objects.filter(message__chat = chat, id = message_file_id).first()

        if message_file is not None:
            return Response(message_file.content, status.HTTP_200_OK, content_type = message_file.content_type)
        else:
            return Response({"error": "File was not found."}, status.HTTP_404_NOT_FOUND)

class GetMessages(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        chat_uuid = request.query_params.get("chat_uuid")
        if not chat_uuid:
            return Response({"error": "'chat_uuid' field must be provided."}, status.HTTP_400_BAD_REQUEST)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
        except:
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
                try:
                    chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
                except Chat.DoesNotExist:
                    return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
                except:
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

        generate_pending_message_in_chat(chat, chat_uuid == "")

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)

class EditMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def patch(self, request: Request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        chat_uuid = request.data.get("chat_uuid")
        if type(chat_uuid) == str:
            try:
                chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            except Chat.DoesNotExist:
                return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
            except:
                return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Invalid data type for 'chat_uuid' field."}, status.HTTP_400_BAD_REQUEST)

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
        user_message.save()

        bot_message.text = ""
        bot_message.model = model
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
        if type(chat_uuid) == str:
            try:
                chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            except Chat.DoesNotExist:
                return Response({"error": "Chat was not found."}, status.HTTP_404_NOT_FOUND)
            except:
                return Response({"error": "Invalid chat UUID."}, status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Invalid data type for 'chat_uuid' field."}, status.HTTP_400_BAD_REQUEST)

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
        bot_message.save()

        chat.pending_message = bot_message
        chat.save()

        generate_pending_message_in_chat(chat, should_randomize = True)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)