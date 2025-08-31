from django.contrib.auth import authenticate
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
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
from .tasks import reset_stopped_incomplete_chats

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
        fields = ["title", "is_complete", "uuid"]

class MessageFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageFile
        fields = ["name"]

class MessageSerializer(serializers.ModelSerializer):
    files = MessageFileSerializer(many = True, read_only = True)
    text = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["text", "files", "is_user_message"]

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

class GetMessage(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chat_uuid = request.data["chat_uuid"]
            message_index = int(request.data["message_index"])
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            message = Message.objects.filter(chat = chat).order_by("date_time")[message_index]
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

        messages = Message.objects.filter(chat = chat).order_by("date_time").prefetch_related("files")
        serializer = MessageSerializer(messages, many = True)
        return Response({"messages": serializer.data})

class UploadFiles(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        try:
            if len(request.FILES.getlist("files")) > 10:
                return Response({"error": "You can only upload up to 10 files at a time"}, 400)

            total_size = 0
            for file in request.FILES.getlist("files"):
                total_size += file.size
            if total_size > 5_000_000:
                return Response({"error": "Total file size exceeds limit of 5 MB"}, 400)

            uploaded_metadata = []

            for file in request.FILES.getlist("files"):
                path = default_storage.save(f"chat_temp/{file.name}", ContentFile(file.read()))
                uploaded_metadata.append({
                    "name": file.name,
                    "content_type": file.content_type,
                    "file": path,
                    "url": default_storage.url(path)
                })

            return Response(uploaded_metadata)
        except Exception:
            return Response(status = 400)

class CreateChat(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        chat = Chat.objects.create(user = request.user, title = f"Chat {Chat.objects.filter(user = request.user).count() + 1}")
        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        chats = Chat.objects.filter(user = request.user).order_by("date_time")
        serializer = ChatSerializer(chats, many = True)
        return Response({"chats": serializer.data})

    def post(self, request):
        incomplete_flag = request.data.get("incomplete", None)
        if incomplete_flag is None:
            return Response({"error": "'incomplete' field required"}, status = 400)

        reset_stopped_incomplete_chats(request.user)

        chats = Chat.objects.filter(user = request.user, is_complete = False).order_by("date_time")
        serializer = ChatSerializer(chats, many = True)
        return Response({"chats": serializer.data})

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            search = request.data["search"]
            matched_messages = Message.objects.filter(text__icontains = search).order_by("date_time")
            chats = Chat.objects.filter(user = request.user).order_by("date_time").filter(
                Q(title__icontains = search) | Q(messages__text__icontains = search)
            ).order_by("date_time").distinct().prefetch_related(
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

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            request.user.delete()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

def index(request):
    return render(request, "index.html")