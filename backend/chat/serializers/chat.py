from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..models import Chat

class ChatSerializer(serializers.ModelSerializer):
    pending_message_id = serializers.SerializerMethodField()
    index = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ["uuid", "title", "pending_message_id", "is_archived", "is_temporary", "index"]

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
    chat_uuid = serializers.UUIDField()

class GetChatsSerializer(serializers.Serializer):
    offset = serializers.IntegerField(min_value = 0, default = 0)
    limit = serializers.IntegerField(min_value = 1, default = 20)
    pending = serializers.BooleanField(default = False)
    archived = serializers.BooleanField(default = False)

class SearchChatsSerializer(serializers.Serializer):
    search = serializers.CharField(default = "")
    offset = serializers.IntegerField(min_value = 0, default = 0)
    limit = serializers.IntegerField(min_value = 1, default = 20)

class RenameChatSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField()
    new_title = serializers.CharField()