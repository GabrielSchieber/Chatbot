import os

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView

from .models import Chat, Message, User
from .totp_utils import decrypt_secret

if not settings.DEBUG or os.getenv("PLAYWRIGHT_TEST") != "True":
    raise Exception("Django DEBUG and PLAYWRIGHT_TEST variables must be both True for using test views.")

class CreateChats(APIView):
    def post(self, request: Request):
        email = request.data.get("email")
        chats_json = request.data.get("chats")

        try:
            user = User.objects.get(email = email)
        except User.DoesNotExist:
            return Response({"error": f"User with {email} email does not exist."}, status.HTTP_400_BAD_REQUEST)

        chats = Chat.objects.bulk_create([Chat(user = user, title = chat_json["title"]) for chat_json in chats_json])
        for chat, chat_json in zip(chats, chats_json):
            Message.objects.bulk_create([
                Message(chat = chat, text = message["text"], is_from_user = message["is_from_user"])
                for message in chat_json["messages"]
            ])

        return Response([str(c.uuid) for c in chats], status.HTTP_200_OK)

class GetMFASecret(APIView):
    def get(self, request: Request):
        email = request.GET.get("email")

        try:
            user = User.objects.get(email = email)
        except User.DoesNotExist:
            return Response({"error": "User does not exist."}, status.HTTP_400_BAD_REQUEST)

        if not user.mfa.is_enabled:
            return Response({"error": "MFA is not enabled."}, status.HTTP_400_BAD_REQUEST)

        return Response(decrypt_secret(user.mfa.secret), status.HTTP_200_OK)