from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView

from ..models import Chat, Message, MessageFile, User
from ..serializers.chat import ChatSerializer, ChatUUIDSerializer
from ..serializers.message import (
    EditMessageSerializer, GetMessageFileContentSerializer,
    MessageSerializer, NewMessageSerializer, RegenerateMessageSerializer
)
from ..throttles import MessageRateThrottle

from ..tasks import generate_pending_message_in_chat, is_any_user_chat_pending

class BinaryFileRenderer(BaseRenderer):
    media_type = "application/octet-stream"
    format = "binary"
    charset = None
    render_style = "binary"

    def render(self, data, media_type = None, renderer_context = None):
        return data

class GetMessageFileContent(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [BinaryFileRenderer, JSONRenderer]

    @extend_schema(parameters=[GetMessageFileContentSerializer], responses={200: bytes})
    def get(self, request: Request):
        user: User = request.user

        qs = GetMessageFileContentSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]
        message_file_id = qs.validated_data["message_file_id"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        try:
            message_file = MessageFile.objects.get(message__chat = chat, id = message_file_id)
        except MessageFile.DoesNotExist:
            return Response({"detail": "Message file was not found."}, status.HTTP_404_NOT_FOUND)

        return Response(message_file.content, status.HTTP_200_OK, content_type = message_file.content_type)

class GetMessageFileIDs(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[ChatUUIDSerializer],
        responses={200: OpenApiTypes.OBJECT}
    )
    def get(self, request: Request):
        user: User = request.user

        qs = ChatUUIDSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]

        try:
            chat = user.chats.get(uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        file_ids = []
        for files in [m.files for m in chat.messages.order_by("created_at")]:
            file_ids.append([f.pk for f in files.order_by("created_at")])
        return Response(file_ids, status.HTTP_200_OK)

class GetMessages(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(parameters=[ChatUUIDSerializer], responses=MessageSerializer(many=True))
    def get(self, request: Request):
        user: User = request.user

        qs = ChatUUIDSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        messages = chat.messages.order_by("created_at").prefetch_related("files")
        serializer = MessageSerializer(messages, many = True)
        return Response(serializer.data, status.HTTP_200_OK)

class NewMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [MessageRateThrottle]

    @extend_schema(request=NewMessageSerializer, responses=ChatSerializer)
    def post(self, request: Request):
        user: User = request.user

        if is_any_user_chat_pending(user):
            return Response({"detail": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        qs = NewMessageSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data.get("chat_uuid")
        text = qs.validated_data["text"]
        model = qs.validated_data["model"]
        files = qs.validated_data["files"]
        temporary = qs.validated_data["temporary"]

        if chat_uuid is None:
            chat = user.chats.create(title = f"Chat {user.chats.filter(is_temporary = False).count() + 1}", is_temporary = temporary)
        else:
            try:
                chat = user.chats.get(uuid = chat_uuid)
            except Chat.DoesNotExist:
                return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        user_message = chat.messages.create(text = text, is_from_user = True)
        new_files = []
        for file in files:
            file.seek(0)
            new_files.append(MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type))
        user_message.files.bulk_create(new_files)

        bot_message = chat.messages.create(text = "", is_from_user = False, model = model)

        chat.pending_message = bot_message
        chat.save()

        generate_pending_message_in_chat(chat, chat_uuid == None and not temporary)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)

class EditMessage(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [MessageRateThrottle]

    @extend_schema(request=EditMessageSerializer, responses=ChatSerializer)
    def patch(self, request: Request):
        user: User = request.user

        if is_any_user_chat_pending(user):
            return Response({"detail": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        qs = EditMessageSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]
        index = qs.validated_data["index"]
        text = qs.validated_data["text"]
        model = qs.validated_data["model"]
        added_files = qs.validated_data["added_files"]
        removed_file_ids = qs.validated_data["removed_file_ids"]

        try:
            chat = user.chats.get(uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        if index + 1 >= chat.messages.count():
            return Response({"detail": "Index out of range."}, status.HTTP_404_NOT_FOUND)

        messages = chat.messages.order_by("created_at")
        user_message: Message = messages[index]

        removed_files: list[MessageFile] = []
        for removed_file_id in removed_file_ids:
            removed_message_file = user_message.files.filter(id = removed_file_id).first()
            if removed_message_file:
                removed_files.append(removed_message_file)

        if user_message.files.count() + len(added_files) - len(removed_files) > 10:
            return Response({"detail": "Total number of files exceeds the limit of 10."}, status.HTTP_400_BAD_REQUEST)

        total_size = sum([len(f.content) for f in user_message.files.all()])
        total_size += sum([f.size for f in added_files])
        total_size -= sum([len(f.content) for f in removed_files])
        if total_size > 5_000_000:
            return Response({"detail": "Total file size exceeds limit of 5 MB."}, status.HTTP_400_BAD_REQUEST)

        for removed_file in removed_files:
            removed_file.delete()

        user_message.text = text

        new_files = []
        for file in added_files:
            file.seek(0)
            new_files.append(MessageFile(message = user_message, name = file.name, content = file.read(), content_type = file.content_type))
        user_message.files.bulk_create(new_files)

        user_message.save()

        bot_message: Message = messages[index + 1]
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
    throttle_classes = [MessageRateThrottle]

    @extend_schema(request=RegenerateMessageSerializer, responses=ChatSerializer)
    def patch(self, request: Request):
        user: User = request.user

        if is_any_user_chat_pending(user):
            return Response({"detail": "A chat is already pending."}, status.HTTP_400_BAD_REQUEST)

        qs = RegenerateMessageSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]
        index = qs.validated_data["index"]
        model = qs.validated_data["model"]

        try:
            chat = user.chats.get(uuid = chat_uuid)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        if index >= chat.messages.count():
            return Response({"detail": "Index out of range."}, status.HTTP_404_NOT_FOUND)

        bot_message: Message = chat.messages.order_by("created_at")[index]
        bot_message.text = ""
        bot_message.model = model
        bot_message.save()

        chat.pending_message = bot_message
        chat.save()

        generate_pending_message_in_chat(chat, should_randomize = True)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)