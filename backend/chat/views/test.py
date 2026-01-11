import os

if os.getenv("DJANGO_TEST") != "True" and os.getenv("PLAYWRIGHT_TEST") != "True":
    raise RuntimeError("DJANGO_TEST or PLAYWRIGHT_TEST environment variable must be 'True' for using test views.")

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Chat, Message, MessageFile, User, UserMFA

class CreateChat(APIView):
    def post(self, request: Request):
        email = request.data.get("email")
        title = request.data.get("title")
        messages = request.data.get("messages")

        try:
            user: User = User.objects.get(email = email)
        except Chat.DoesNotExist:
            return Response({"detail": "User was not found."}, status.HTTP_404_NOT_FOUND)

        chat = user.chats.create(title = title)
        chat.messages.bulk_create([Message(chat = chat, text = m["text"], is_from_user = m["is_from_user"]) for m in messages])
        chat.refresh_from_db()
        for c_m, m in zip(chat.messages.order_by("created_at"), messages):
            c_m.files.bulk_create([
                MessageFile(message = c_m, name = f["name"], content = f["content"].encode(), content_type = f["content_type"])
                for f in m["files"]
            ])
        return Response(status = status.HTTP_200_OK)

class CreateChats(APIView):
    def post(self, request: Request):
        email = request.data.get("email")
        chats_json = request.data.get("chats")

        try:
            user: User = User.objects.get(email = email)
        except Chat.DoesNotExist:
            return Response({"detail": "User was not found."}, status.HTTP_404_NOT_FOUND)

        chats = Chat.objects.bulk_create([Chat(user = user, title = chat_json["title"]) for chat_json in chats_json])
        for chat, chat_json in zip(chats, chats_json):
            Message.objects.bulk_create([
                Message(chat = chat, text = message["text"], is_from_user = message["is_from_user"])
                for message in chat_json["messages"]
            ])

        return Response([str(c.uuid) for c in chats], status.HTTP_200_OK)

class GetMFASecret(APIView):
    def get(self, request: Request):
        email = request.query_params.get("email")

        try:
            user: User = User.objects.get(email = email)
        except Chat.DoesNotExist:
            return Response({"detail": "User was not found."}, status.HTTP_404_NOT_FOUND)

        if not user.mfa.is_enabled:
            return Response({"detail": "MFA is not enabled."}, status.HTTP_400_BAD_REQUEST)

        return Response(UserMFA.decrypt_secret(user.mfa.secret), status.HTTP_200_OK)

class EchoAuthHeaderView(APIView):
    authentication_classes = []

    def get(self, request: Request):
        return Response({"auth": request.META.get("HTTP_AUTHORIZATION")})