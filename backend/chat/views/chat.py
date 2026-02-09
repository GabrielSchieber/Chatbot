from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView

from ..models import Chat, User
from ..serializers.chat import ChatSerializer, ChatUUIDSerializer, GetChatsSerializer, RenameChatSerializer, SearchChatsSerializer
from ..tasks import stop_pending_chat, stop_user_pending_chats

class GetChat(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get Chat",
        description="Retrieve details of a specific chat session.",
        tags=["Chats"],
        parameters=[ChatUUIDSerializer],
        responses={
            200: ChatSerializer,
            404: OpenApiTypes.OBJECT
        }
    )
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

    @extend_schema(
        summary="List Chats",
        description="Retrieve a paginated list of chats for the current user.",
        tags=["Chats"],
        parameters=[GetChatsSerializer],
        responses=inline_serializer(
            name="GetChatsResponse",
            fields={
                "chats": ChatSerializer(many=True),
                "has_more": serializers.BooleanField()
            }
        )
    )
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

    @extend_schema(
        summary="Search Chats",
        description="Search through chat titles and messages.",
        tags=["Chats"],
        parameters=[SearchChatsSerializer],
        responses=inline_serializer(
            name="SearchChatsResponse",
            fields={
                "entries": inline_serializer(
                    name="SearchChatEntry",
                    many=True,
                    fields={
                        "uuid": serializers.UUIDField(),
                        "title": serializers.CharField(),
                        "is_archived": serializers.BooleanField(),
                        "matches": serializers.ListField(child=serializers.CharField()),
                        "last_modified_at": serializers.DateTimeField()
                    }
                ),
                "has_more": serializers.BooleanField()
            }
        )
    )
    def get(self, request: Request):
        user: User = request.user

        qs = SearchChatsSerializer(data = request.query_params)
        qs.is_valid(raise_exception = True)

        search = qs.validated_data["search"]
        offset = qs.validated_data["offset"]
        limit = qs.validated_data["limit"]

        chats = user.chats.filter(Q(title__icontains = search) | Q(messages__text__icontains = search)).distinct().order_by("-created_at")

        entries = [{
            "uuid": chat.uuid,
            "title": chat.title,
            "is_archived": chat.is_archived,
            "matches": [
                m.text[:100] for m in chat.messages.filter(
                    ~Q(text = "") & (Q(chat__title__icontains = search) | Q(text__icontains = search))
                ).distinct().order_by("created_at")[:5]
            ],
            "last_modified_at": chat.last_modified_at().isoformat()
        } for chat in chats[offset:offset + limit]]

        return Response({"entries": entries, "has_more": offset + limit < chats.count()}, status.HTTP_200_OK)

class RenameChat(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Rename Chat",
        tags=["Chats"],
        request=RenameChatSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        }
    )
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

    @extend_schema(
        summary="Archive Chat",
        tags=["Chats"],
        request=ChatUUIDSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        }
    )
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

    @extend_schema(
        summary="Unarchive Chat",
        tags=["Chats"],
        request=ChatUUIDSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        }
    )
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

    @extend_schema(
        summary="Delete Chat",
        tags=["Chats"],
        request=ChatUUIDSerializer,
        responses={
            204: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        }
    )
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

    @extend_schema(summary="Archive All Chats", tags=["Chats"], request=None, responses=None)
    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).update(is_archived = True)
        return Response(status = status.HTTP_200_OK)

class UnarchiveChats(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Unarchive All Chats", tags=["Chats"], request=None, responses=None)
    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).update(is_archived = False)
        return Response(status = status.HTTP_200_OK)

class DeleteChats(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Delete All Chats", tags=["Chats"], request=None, responses=None)
    def delete(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).delete()
        return Response(status = status.HTTP_204_NO_CONTENT)

class StopPendingChats(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Stop Pending Chats", tags=["Chats"], request=None, responses=None)
    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        return Response(status = status.HTTP_200_OK)