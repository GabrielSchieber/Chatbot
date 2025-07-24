from django.contrib.auth import authenticate
from django.db.models import Prefetch, Q
from django.shortcuts import render
from rest_framework import generics, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .consumers import generate_message_tasks
from .models import Chat, Message, User
from .utils import markdown_to_html

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only = True)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(email = validated_data["email"], password = validated_data["password"])

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

    def post(self, request):
        response = Response({"success": True})
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({"id": user.id, "email": user.email})

class GetMessage(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chat_uuid = request.data["chat_uuid"]
            message_index = int(request.data["message_index"])
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            message = Message.objects.filter(chat = chat)[message_index]
            return Response({"text": message.text})
        except Exception:
            return Response(status = 400)

class GetMessages(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chat_uuid = request.data["chat_uuid"]
            chat = Chat.objects.get(user = request.user, uuid = chat_uuid)
            messages = [m.text if m.is_user_message else markdown_to_html(m.text) for m in Message.objects.filter(chat = chat)]
            return Response({"messages": messages})
        except Exception:
            return Response(status = 400)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            chats = Chat.objects.filter(user = request.user)
            return Response({"chats": [{"title": chat.title, "uuid": chat.uuid} for chat in chats]})
        except Exception:
            return Response(status = 400)

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            search = request.data["search"]
            matched_messages = Message.objects.filter(text__icontains = search)
            chats = Chat.objects.filter(user = request.user).filter(
                Q(title__icontains = search) | Q(messages__text__icontains = search)
            ).distinct().prefetch_related(
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

    def post(self, request):
        try:
            Chat.objects.filter(user = request.user).delete()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            request.user.delete()
            return Response(status = 200)
        except Exception:
            return Response(status = 400)

class Generating(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            chats = Chat.objects.filter(user = request.user, is_complete = False)
            for chat in chats:
                if chat.uuid not in generate_message_tasks:
                    chat.is_complete = True
                    chat.save()
            chats = Chat.objects.filter(user = request.user, is_complete = False)
            return Response([{"title": chat.title, "uuid": str(chat.uuid)} for chat in chats], 200)
        except Exception:
            return Response(status = 400)

def index(request):
    return render(request, "index.html")