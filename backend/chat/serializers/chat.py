from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..models import Chat

class ChatSerializer(serializers.ModelSerializer):
    pending_message_id = serializers.SerializerMethodField()
    index = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ["uuid", "title", "pending_message_id", "is_archived", "is_temporary", "index"]
        extra_kwargs = {
            "uuid": {"help_text": "Unique identifier for the chat session."},
            "title": {"help_text": "Title of the chat."},
            "is_archived": {"help_text": "Whether the chat is archived."},
            "is_temporary": {"help_text": "Whether the chat is temporary (not saved to history)."},
        }

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_pending_message_id(self, chat: Chat):
        return chat.pending_message.id if chat.pending_message is not None else None

    @extend_schema_field(serializers.IntegerField())
    def get_index(self, chat: Chat):
        for i, c in enumerate(chat.user.chats.order_by("-created_at")):
            if c == chat:
                return i
        return 0

class ChatUUIDSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(help_text="The UUID of the chat.")

class GetChatsSerializer(serializers.Serializer):
    offset = serializers.IntegerField(min_value = 0, default = 0, help_text="Pagination offset.")
    limit = serializers.IntegerField(min_value = 1, default = 20, help_text="Number of chats to return.")
    pending = serializers.BooleanField(default = False, help_text="Filter for chats with pending messages.")
    archived = serializers.BooleanField(default = False, help_text="Filter for archived chats.")

class SearchChatsSerializer(serializers.Serializer):
    search = serializers.CharField(default = "", help_text="Search term for chat titles or messages.")
    offset = serializers.IntegerField(min_value = 0, default = 0, help_text="Pagination offset.")
    limit = serializers.IntegerField(min_value = 1, default = 20, help_text="Number of results to return.")

class RenameChatSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(help_text="The UUID of the chat to rename.")
    new_title = serializers.CharField(help_text="The new title for the chat.")