import os

if os.getenv("DJANGO_TEST") != "True" and os.getenv("PLAYWRIGHT_TEST") != "True":
    raise RuntimeError("DJANGO_TEST or PLAYWRIGHT_TEST environment variable must be 'True' for using test views.")

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Chat, Message, MessageFile, User, UserMFA

class CreateChat(APIView):
    @extend_schema(
        summary="Create Chat",
        tags=["Test"],
        request=inline_serializer(
            name="TestCreateChatRequest",
            fields={
                "email": serializers.EmailField(),
                "title": serializers.CharField(),
                "messages": inline_serializer(
                    name="TestMessage",
                    many=True,
                    fields={
                        "text": serializers.CharField(),
                        "is_from_user": serializers.BooleanField(),
                        "files": inline_serializer(
                            name="TestFile", many=True, fields={"name": serializers.CharField(), "content": serializers.CharField(), "content_type": serializers.CharField()}
                        ),
                    },
                ),
            },
        ),
        responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    )
    def post(self, request: Request):
        email = request.data.get("email")
        title = request.data.get("title")
        messages = request.data.get("messages")

        try:
            user: User = User.objects.get(email = email)
        except User.DoesNotExist:
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
    @extend_schema(
        summary="Create Multiple Chats",
        tags=["Test"],
        request=inline_serializer(
            name="TestCreateChatsRequest",
            fields={
                "email": serializers.EmailField(),
                "chats": inline_serializer(
                    name="TestChat",
                    many=True,
                    fields={
                        "title": serializers.CharField(),
                        "messages": inline_serializer(
                            name="TestChatMessage", many=True, fields={"text": serializers.CharField(), "is_from_user": serializers.BooleanField()}
                        ),
                    },
                ),
            },
        ),
        responses={200: inline_serializer(name="TestCreateChatsResponse", fields={"uuids": serializers.ListField(child=serializers.UUIDField())}), 404: OpenApiTypes.OBJECT},
    )
    def post(self, request: Request):
        email = request.data.get("email")
        chats_data = request.data.get("chats")

        try:
            user: User = User.objects.get(email = email)
        except User.DoesNotExist:
            return Response({"detail": "User was not found."}, status.HTTP_404_NOT_FOUND)

        chats = Chat.objects.bulk_create([Chat(user = user, title = chat_data["title"]) for chat_data in chats_data])
        for chat, chat_data in zip(chats, chats_data):
            Message.objects.bulk_create([
                Message(chat = chat, text = message["text"], is_from_user = message["is_from_user"])
                for message in chat_data["messages"]
            ])

        return Response({"uuids": [str(c.uuid) for c in chats]}, status.HTTP_200_OK)

class GetMFASecret(APIView):
    @extend_schema(
        summary="Get MFA Secret",
        tags=["Test"],
        parameters=[inline_serializer(name="TestGetMFASecretParams", fields={"email": serializers.EmailField()})],
        responses={
            200: inline_serializer(name="MFASecretResponse", fields={"secret": serializers.CharField()}),
            400: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request: Request):
        email = request.query_params.get("email")

        try:
            user: User = User.objects.get(email = email)
        except User.DoesNotExist:
            return Response({"detail": "User was not found."}, status.HTTP_404_NOT_FOUND)

        if not user.mfa.is_enabled:
            return Response({"detail": "MFA is not enabled."}, status.HTTP_400_BAD_REQUEST)

        return Response({"secret": UserMFA.decrypt_secret(user.mfa.secret)}, status.HTTP_200_OK)

class EchoAuthHeaderView(APIView):
    authentication_classes = []

    @extend_schema(
        summary="Echo Authorization Header",
        tags=["Test"],
        responses={200: inline_serializer(name="EchoAuthHeaderResponse", fields={"auth": serializers.CharField(allow_null=True)})},
    )
    def get(self, request: Request):
        return Response({"auth": request.META.get("HTTP_AUTHORIZATION")})