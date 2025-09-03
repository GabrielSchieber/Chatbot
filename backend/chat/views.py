import asyncio
import threading

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
from .tasks import generate_message

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
        fields = ["name", "content_size", "content_type"]

    def get_content_size(self, message_file: MessageFile):
        return len(message_file.content)

class MessageSerializer(serializers.ModelSerializer):
    files = MessageFileSerializer(many = True, read_only = True)
    text = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["text", "files", "role"]

    def get_text(self, obj):
        return obj.text

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
        user = request.user
        return Response({"id": user.id, "email": user.email})

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

class GetTheme(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(request.user.theme, 200)

class SetTheme(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        theme = request.data.get("theme")
        if not theme or theme not in ["System", "Light", "Dark"]:
            return Response("Invalid theme", 400)
        request.user.theme = theme
        request.user.save()
        return Response(status = 200)

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
        chats = Chat.objects.filter(user = request.user).order_by("created_at")
        serializer = ChatSerializer(chats, many = True)
        return Response({"chats": serializer.data})

    def post(self, request):
        pending_flag = request.data.get("pending", None)
        if pending_flag is None:
            return Response({"error": "'pending' field required"}, status = 400)

        chats = Chat.objects.filter(user = request.user, is_pending = True).order_by("created_at")
        serializer = ChatSerializer(chats, many = True)
        return Response({"chats": serializer.data})

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            search = request.data["search"]
            matched_messages = Message.objects.filter(text__icontains = search).order_by("created_at")
            chats = Chat.objects.filter(user = request.user).order_by("created_at").filter(
                Q(title__icontains = search) | Q(messages__text__icontains = search)
            ).order_by("created_at").distinct().prefetch_related(
                Prefetch("messages", queryset = matched_messages, to_attr = "matched_messages")
            )
            chats = [{
                "title": chat.title,
                "uuid": chat.uuid,
                "matches": [message.text for message in chat.matched_messages] if hasattr(chat, "matched_messages") else []
            } for chat in chats]
            return Response({"chats": chats})
        except Exception:
            return Response(status = 400)

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
        print(f"\nNewMessage request:\n{request.data}\n")

        chat_uuid = request.data.get("chat_uuid", "")
        if type(chat_uuid) == str:
            if chat_uuid=="":
                chat = Chat.objects.create(user = request.user, title = f"Chat {Chat.objects.filter(user = request.user).count() + 1}")
            else:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, 400)
        else:
            return Response({"error": "Invalid data type for chat UUID"}, 400)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, 400)

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

        user_message = Message.objects.create(chat = chat, text = message, role = "User")
        if len(files) > 0:
            MessageFile.objects.bulk_create(
                [MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type) for file in files]
            )
        bot_message = Message.objects.create(chat = chat, text = "", role = "Bot")

        threading.Thread(target = asyncio.run, args = [generate_message(chat, user_message, bot_message, model)]).start()

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, 200)

class EditMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        print(f"\nEditMessage request:\n{request.data}\n")

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, 400)
            else:
                return Response({"error": "Invalid data type for chat UUID"}, 400)
        else:
            return Response({"error": "A vald chat UUID is required"}, 400)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, 400)

        message = request.data.get("message", "")
        if type(message) != str:
            return Response({"error": "Invalid data type for message"}, 400)

        message_index = request.data.get("message_index")
        if not message_index:
            return Response({"error": "Index is required"}, 400)
        message_index = int(message_index)

        messages = Message.objects.filter(chat = chat).order_by("created_at")
        user_message = messages[message_index]
        assert user_message.role == "User"
        bot_message = messages[message_index + 1]
        assert bot_message.role == "Bot"

        user_message.text = message
        user_message.save()
        bot_message.text = ""
        bot_message.save()

        threading.Thread(target = asyncio.run, args = [generate_message(chat, user_message, bot_message, model)]).start()

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, 200)

class RegenerateMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        print(f"\nRegenerateMessage request:\n{request.data}\n")

        chat_uuid = request.data.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                chat = Chat.objects.filter(user = request.user, uuid = chat_uuid).first()
                if not chat:
                    return Response({"error": "Invalid chat UUID"}, 400)
            else:
                return Response({"error": "Invalid data type for chat UUID"}, 400)
        else:
            return Response({"error": "A valid chat UUID is required"}, 400)

        model = request.data.get("model", "SmolLM2-135M")
        if type(model) != str:
            return Response({"error": "Invalid data type for model"}, 400)

        message = request.data.get("message", "")
        if type(message) != str:
            return Response({"error": "Invalid data type for message"}, 400)

        message_index = request.data.get("message_index")
        if not message_index:
            return Response({"error": "Index is required"}, 400)
        message_index = int(message_index)

        messages = Message.objects.filter(chat = chat).order_by("created_at")
        user_message = messages[message_index - 1]
        assert user_message.role == "User"
        bot_message = messages[message_index]
        assert bot_message.role == "Bot"

        bot_message.text = ""
        bot_message.save()

        threading.Thread(target = asyncio.run, args = [generate_message(chat, user_message, bot_message, model)]).start()

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, 200)

def index(request):
    return render(request, "index.html")