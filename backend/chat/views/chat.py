from django.db.models import Prefetch, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView

from ..models import Chat, Message, User
from ..serializers.chat import ChatSerializer, ChatUUIDSerializer, GetChatsSerializer, RenameChatSerializer, SearchChatsSerializer
from ..tasks import stop_pending_chat, stop_user_pending_chats

class GetChat(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        user: User = request.user

        qs = ChatUUIDSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        serializer = ChatSerializer(chat, many = False)
        return Response(serializer.data, status.HTTP_200_OK)

class GetChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        user: User = request.user

        qs = GetChatsSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        offset = qs.validated_data["offset"]
        limit = qs.validated_data["limit"]
        pending = qs.validated_data["pending"]
        archived = qs.validated_data["archived"]

        chats = user.chats.filter(is_archived = archived, is_temporary = False)
        if pending:
            chats = chats.exclude(pending_message = None)
        chats = chats.order_by("-created_at")

        serializer = ChatSerializer(chats[offset:offset + limit], many = True)
        return Response({"chats": serializer.data, "has_more": offset + limit < chats.count()}, status.HTTP_200_OK)

class SearchChats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        user: User = request.user

        qs = SearchChatsSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        search = qs.validated_data["search"]
        offset = qs.validated_data["offset"]
        limit = qs.validated_data["limit"]

        matched_messages = Message.objects.filter(chat__user = user, text__icontains = search).order_by("created_at")
        chats = user.chats.filter(Q(title__icontains = search) | Q(messages__text__icontains = search)).distinct().order_by("-created_at")

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
        user: User = request.user

        qs = RenameChatSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]
        new_title = qs.validated_data["new_title"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        chat.title = new_title
        chat.save()
        return Response(status = status.HTTP_200_OK)

class ArchiveChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        user: User = request.user

        qs = ChatUUIDSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        stop_pending_chat(chat)
        chat.is_archived = True
        chat.save()
        return Response(status = status.HTTP_200_OK)

class UnarchiveChat(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request):
        user: User = request.user

        qs = ChatUUIDSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

        stop_pending_chat(chat)
        chat.is_archived = False
        chat.save()
        return Response(status = status.HTTP_200_OK)

class DeleteChat(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        user: User = request.user

        qs = ChatUUIDSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        chat_uuid = qs.validated_data["chat_uuid"]

        try:
            chat = user.chats.get(uuid = chat_uuid, is_temporary = False)
        except Chat.DoesNotExist:
            return Response({"detail": "Chat was not found."}, status.HTTP_404_NOT_FOUND)

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