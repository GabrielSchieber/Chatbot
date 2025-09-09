import json

from django.contrib.auth import authenticate
from django.db.models import Prefetch, Q
from django.shortcuts import render
from rest_framework import generics, serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Chat, Message, MessageFile, User
from .tasks import generate_message, is_any_user_chat_pending, stop_pending_chats

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only = True)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(email = validated_data["email"], password = validated_data["password"])

class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = ["title", "is_pending", "uuid"]

class MessageFileSerializer(serializers.ModelSerializer):
    content_size = serializers.SerializerMethodField()

    class Meta:
        model = MessageFile
        fields = ["id", "name", "content_size", "content_type"]

    def get_content_size(self, message_file: MessageFile):
        return len(message_file.content)

class MessageSerializer(serializers.ModelSerializer):
    files = MessageFileSerializer(many = True, read_only = True)

    class Meta:
        model = Message
        fields = ["text", "is_from_user", "files", "model"]

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(request, email = email, password = password)
        if user is not None:
            refresh = RefreshToken.for_user(user)
            response = Response({"success": True})
            response.set_cookie("access_token", str(refresh.access_token), httponly = True, samesite = "Lax")
            response.set_cookie("refresh_token", str(refresh), httponly = True, samesite = "Lax")
            return response
        else:
            return Response({"error": "Invalid credentials"}, 400)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = Response({"success": True})
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user: User = request.user
        return Response({"id": user.id, "email": user.email, "theme": user.theme, "has_sidebar_open": user.has_sidebar_open})

    def post(self, request):
        user: User = request.user

        theme = request.data.get("theme")
        if theme != None: 
            if theme not in ["System", "Light", "Dark"]:
                return Response({"error": "Invalid theme"}, 400)
            user.theme = theme

        has_sidebar_open = request.data.get("has_sidebar_open")
        if has_sidebar_open != None:
            if type(has_sidebar_open) != bool:
                return Response({"error": "Invalid data type for has_sidebar_open"}, 400)
            user.has_sidebar_open = has_sidebar_open

        user.save()
        return Response(status = 200)

class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response({"error": "No refresh token"}, status = status.HTTP_401_UNAUTHORIZED)

        serializer = self.get_serializer(data = {"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception = True)
        except Exception:
            return Response({"error": "Invalid refresh token"}, status = status.HTTP_401_UNAUTHORIZED)

        access = serializer.validated_data["access"]
        new_refresh = serializer.validated_data.get("refresh")

        response = Response({"success": True})
        response.set_cookie("access_token", access, httponly = True, samesite = "Lax")
        if new_refresh:
            response.set_cookie("refresh_token", new_refresh, httponly = True, samesite = "Lax")
        return response

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            request.user.delete()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pending = request.GET.get("pending", False)
        if pending:
            chats = Chat.objects.filter(user = request.user, is_pending = True).order_by("created_at")
            serializer = ChatSerializer(chats, many = True)
            return Response({"chats": serializer.data})

        limit = int(request.GET.get("limit", 20))
        offset = int(request.GET.get("offset", 0))

        chats = Chat.objects.filter(user = request.user).order_by("-created_at")
        total = chats.count()
        chats = chats[offset:offset + limit]

        serializer = ChatSerializer(chats, many = True)
        return Response({"chats": serializer.data, "has_more": offset + limit < total})

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = request.GET.get("search", "")
        limit = int(request.GET.get("limit", 20))
        offset = int(request.GET.get("offset", 0))

        matched_messages = Message.objects.filter(text__icontains = search).order_by("created_at")

        chats_qs = Chat.objects.filter(user = request.user).filter(
            Q(title__icontains=search) | Q(messages__text__icontains = search)
        ).distinct().order_by("-created_at")

        total = chats_qs.count()
        chats_qs = chats_qs[offset:offset + limit]

        chats_qs = chats_qs.prefetch_related(Prefetch("messages", queryset = matched_messages, to_attr = "matched_messages"))

        chats = [{
            "title": chat.title,
            "uuid": chat.uuid,
            "matches": [m.text for m in getattr(chat, "matched_messages", [])]
        } for chat in chats_qs]

        return Response({
            "chats": chats,
            "has_more": offset + limit < total
        })

class RenameChat(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chat_uuid = request.data["chat_uuid"]
            new_title = request.data["new_title"]
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            chat.title = new_title
            chat.save()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

class DeleteChat(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chat_uuid = request.data["chat_uuid"]
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            chat.delete()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

class DeleteChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            Chat.objects.filter(user = request.user).delete()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

class StopPendingChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stop_pending_chats(request.user)
        return Response(status = 200)

class GetMessage(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chat_uuid = request.data["chat_uuid"]
            message_index = int(request.data["message_index"])
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            message = Message.objects.filter(chat = chat).order_by("created_at")[message_index]
            return Response({"text": message.text})
        except Exception:
            return Response(status = 400)

class GetMessages(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        chat_uuid = request.data.get("chat_uuid")
        if not chat_uuid:
            return Response({"error": "chat_uuid required"}, status = 400)

        try:
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
        except:
            return Response({"error": "Chat not found"}, status = 404)

        messages = Message.objects.filter(chat = chat).order_by("created_at").prefetch_related("files")
        serializer = MessageSerializer(messages, many = True)
        return Response({"messages": serializer.data})

class NewMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending"}, 400)

        chat_uuid = request.data.get("chat_uuid", "")
        if type(chat_uuid) == str:
            if chat_uuid=="":
                chat = Chat.objects.create(user = request.user, title = f"Chat {Chat.objects.filter(user = request.user).count() + 1}", is_pending = True)
            else:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, 400)
                chat.is_pending = True
                chat.save()
        else:
            return Response({"error": "Invalid data type for chat UUID"}, 400)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, 400)

        options = json.loads(request.data.get("options", "{}"))
        if type(model) != dict and type(model) == set:
            return Response({"error": "Invalid data type for options"}, 400)

        message = request.data.get("message", "")
        if type(message) != str:
            return Response({"error": "Invalid data type for message"}, 400)

        files = request.FILES.getlist("files")
        if type(files) != list:
            return Response({"error": "Invalid data type for files"}, 400)

        total_size = 0
        for file in files:
            total_size += file.size
        if total_size > 5_000_000:
            return Response({"error": "Total file size exceeds limit of 5 MB"}, 400)

        user_message = Message.objects.create(chat = chat, text = message, is_from_user = True)
        if len(files) > 0:
            MessageFile.objects.bulk_create(
                [MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type) for file in files]
            )
        bot_message = Message.objects.create(chat = chat, text = "", is_from_user = False)

        generate_message(chat, user_message, bot_message, model, options)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, 200)

class EditMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending"}, 400)

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, 400)
                chat.is_pending = True
                chat.save()
            else:
                return Response({"error": "Invalid data type for chat UUID"}, 400)
        else:
            return Response({"error": "A vald chat UUID is required"}, 400)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, 400)

        options = json.loads(request.data.get("options", "{}"))
        if type(model) != dict and type(model) == set:
            return Response({"error": "Invalid data type for options"}, 400)

        message = request.data.get("message", "")
        if type(message) != str:
            return Response({"error": "Invalid data type for message"}, 400)

        message_index = request.data.get("message_index")
        if not message_index:
            return Response({"error": "Index is required"}, 400)
        message_index = int(message_index)

        added_files = request.FILES.getlist("added_files")
        if type(added_files) != list:
            return Response({"error": "Invalid data type for added files"}, 400)

        removed_file_ids = request.data.get("removed_file_ids", [])
        if type(removed_file_ids) == str:
            removed_file_ids = [removed_file_ids]
        removed_file_ids = [int(removed_file_id) for removed_file_id in removed_file_ids]

        messages = Message.objects.filter(chat = chat).order_by("created_at")
        user_message = messages[message_index]

        removed_files: list[MessageFile] = []
        for removed_file_id in removed_file_ids:
            removed_message_file = MessageFile.objects.filter(message = user_message, id = removed_file_id).first()
            if removed_message_file:
                removed_files.append(removed_message_file)

        total_size = 0
        for file in added_files:
            total_size += file.size
        for file in removed_files:
            total_size += len(file.content)
        if total_size > 5_000_000:
            return Response({"error": "Total file size exceeds limit of 5 MB"}, 400)

        bot_message = messages[message_index + 1]

        user_message.text = message
        user_message.save()
        bot_message.text = ""
        bot_message.save()

        for removed_file in removed_files:
            removed_file.delete()

        MessageFile.objects.bulk_create(
            [MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type) for file in added_files]
        )

        generate_message(chat, user_message, bot_message, model, options)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, 200)

class RegenerateMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        if is_any_user_chat_pending(request.user):
            return Response({"error": "A chat is already pending"}, 400)

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, 400)
                chat.is_pending = True
                chat.save()
            else:
                return Response({"error": "Invalid data type for chat UUID"}, 400)
        else:
            return Response({"error": "A valid chat UUID is required"}, 400)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, 400)

        options = json.loads(request.data.get("options", "{}"))
        if type(model) != dict and type(model) == set:
            return Response({"error": "Invalid data type for options"}, 400)

        message = request.data.get("message", "")
        if type(message) != str:
            return Response({"error": "Invalid data type for message"}, 400)

        message_index = request.data.get("message_index")
        if not message_index:
            return Response({"error": "Index is required"}, 400)
        message_index = int(message_index)

        messages = Message.objects.filter(chat = chat).order_by("created_at")
        user_message = messages[message_index - 1]
        bot_message = messages[message_index]

        bot_message.text = ""
        bot_message.save()

        generate_message(chat, user_message, bot_message, model, options)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, 200)

def index(request):
    return render(request, "index.html")