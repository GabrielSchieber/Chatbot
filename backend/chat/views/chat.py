from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer, OpenApiExample
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
        summary="Retrieve Chat Details",
        description="Retrieve details of a specific chat session by its UUID. "
                    "The response includes the chat title, archive status, and pending message ID.",
        tags=["Chats"],
        parameters=[ChatUUIDSerializer],
        responses={
            200: ChatSerializer,
            404: OpenApiTypes.OBJECT
        },
        examples=[
            OpenApiExample(
                "Chat Not Found",
                value={"detail": "Chat was not found."},
                response_only=True,
                status_codes=[404]
            )
        ]
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
        summary="List User Chats",
        description="Retrieve a paginated list of chats for the current user. "
                    "Supports filtering by 'pending' (chats with generating messages) and 'archived' status. "
                    "Returns a list of chat objects and a boolean indicating if more results are available.",
        tags=["Chats"],
        parameters=[GetChatsSerializer],
        responses=inline_serializer(
            name="GetChatsResponse",
            fields={
                "chats": ChatSerializer(many=True),
                "has_more": serializers.BooleanField(help_text="Whether there are more chats available to fetch.")
            }
        ),
        examples=[
            OpenApiExample(
                "Example Response",
                value={
                    "chats": [
                        {
                            "uuid": "123e4567-e89b-12d3-a456-426614174000",
                            "title": "Project Discussion",
                            "pending_message_id": None,
                            "is_archived": False,
                            "is_temporary": False,
                            "index": 0
                        }
                    ],
                    "has_more": True
                },
                response_only=True,
                status_codes=[200]
            )
        ]
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
        summary="Search Conversations",
        description="Search through chat titles and message content. "
                    "Returns a list of matches with snippets of the matching text.",
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
                        "matches": serializers.ListField(child=serializers.CharField(), help_text="List of message snippets matching the search query."),
                        "last_modified_at": serializers.DateTimeField()
                    }
                ),
                "has_more": serializers.BooleanField(help_text="Whether there are more search results.")
            }
        ),
        examples=[
            OpenApiExample(
                "Example Response",
                value={
                    "entries": [
                        {
                            "uuid": "123e4567-e89b-12d3-a456-426614174000",
                            "title": "Python Help",
                            "is_archived": False,
                            "matches": ["How do I use Django?", "Django is a web framework..."],
                            "last_modified_at": "2023-10-27T10:00:00Z"
                        }
                    ],
                    "has_more": False
                },
                response_only=True,
                status_codes=[200]
            )
        ]
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
        summary="Rename Chat Title",
        description="Update the title of a specific chat session.",
        tags=["Chats"],
        request=RenameChatSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        },
        examples=[
            OpenApiExample(
                "Rename Request",
                value={
                    "chat_uuid": "123e4567-e89b-12d3-a456-426614174000",
                    "new_title": "New Conversation Title"
                },
                request_only=True
            ),
            OpenApiExample(
                "Chat Not Found",
                value={"detail": "Chat was not found."},
                response_only=True,
                status_codes=[404]
            )
        ]
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
        summary="Archive Chat Session",
        description="Archive a chat session. Archived chats are hidden from the main list but can be viewed in the archive.",
        tags=["Chats"],
        request=ChatUUIDSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        },
        examples=[
            OpenApiExample(
                "Request Body",
                value={"chat_uuid": "123e4567-e89b-12d3-a456-426614174000"},
                request_only=True
            ),
            OpenApiExample(
                "Chat Not Found",
                value={"detail": "Chat was not found."},
                response_only=True,
                status_codes=[404]
            )
        ]
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
        summary="Unarchive Chat Session",
        description="Restore a chat session from the archive.",
        tags=["Chats"],
        request=ChatUUIDSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        },
        examples=[
            OpenApiExample(
                "Request Body",
                value={"chat_uuid": "123e4567-e89b-12d3-a456-426614174000"},
                request_only=True
            ),
            OpenApiExample(
                "Chat Not Found",
                value={"detail": "Chat was not found."},
                response_only=True,
                status_codes=[404]
            )
        ]
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
        summary="Delete Chat Session",
        description="Permanently delete a chat session and all its messages.",
        tags=["Chats"],
        request=ChatUUIDSerializer,
        responses={
            204: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT
        },
        examples=[
            OpenApiExample(
                "Request Body",
                value={"chat_uuid": "123e4567-e89b-12d3-a456-426614174000"},
                request_only=True
            ),
            OpenApiExample(
                "Chat Not Found",
                value={"detail": "Chat was not found."},
                response_only=True,
                status_codes=[404]
            )
        ]
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

    @extend_schema(
        summary="Archive All Chats",
        description="Archive all active (non-archived) chats for the current user.",
        tags=["Chats"],
        request=None,
        responses={200: OpenApiTypes.OBJECT}
    )
    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).update(is_archived = True)
        return Response(status = status.HTTP_200_OK)

class UnarchiveChats(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Unarchive All Chats",
        description="Restore all archived chats for the current user to the active list.",
        tags=["Chats"],
        request=None,
        responses={200: OpenApiTypes.OBJECT}
    )
    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).update(is_archived = False)
        return Response(status = status.HTTP_200_OK)

class DeleteChats(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Delete All Chats",
        description="Permanently delete all chats (both active and archived) for the current user. This action cannot be undone.",
        tags=["Chats"],
        request=None,
        responses={204: OpenApiTypes.OBJECT}
    )
    def delete(self, request: Request):
        stop_user_pending_chats(request.user)
        Chat.objects.filter(user = request.user).delete()
        return Response(status = status.HTTP_204_NO_CONTENT)

class StopPendingChats(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Stop Pending Generations",
        description="Stop any ongoing AI message generations for the current user across all chats.",
        tags=["Chats"],
        request=None,
        responses={200: OpenApiTypes.OBJECT}
    )
    def patch(self, request: Request):
        stop_user_pending_chats(request.user)
        return Response(status = status.HTTP_200_OK)