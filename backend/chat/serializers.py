from rest_framework import serializers

from .models import Chat, Message, MessageFile, User, UserMFA, UserPreferences

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ["language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about"]

class UserMFASerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMFA
        fields = ["is_enabled"]

class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(many = False, read_only = True)
    mfa = UserMFASerializer(many = False, read_only = True)

    class Meta:
        model = User
        fields = ["email", "preferences", "mfa"]

class ChatSerializer(serializers.ModelSerializer):
    pending_message_id = serializers.SerializerMethodField()
    index = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ["uuid", "title", "pending_message_id", "is_archived", "index"]

    def get_pending_message_id(self, chat: Chat):
        return chat.pending_message.id if chat.pending_message is not None else None

    def get_index(self, chat: Chat):
        for i, c in enumerate(chat.user.chats.order_by("-created_at")):
            if c == chat:
                return i
        return 0

class MessageFileSerializer(serializers.ModelSerializer):
    content = serializers.SerializerMethodField()
    content_size = serializers.SerializerMethodField()

    class Meta:
        model = MessageFile
        fields = ["id", "name", "content", "content_size", "content_type"]

    def get_content(self, message_file: MessageFile):
        return None

    def get_content_size(self, message_file: MessageFile):
        return len(message_file.content)

class MessageSerializer(serializers.ModelSerializer):
    files = MessageFileSerializer(many = True, read_only = True)

    class Meta:
        model = Message
        fields = ["id", "text", "is_from_user", "files", "model"]

class GetChatsGETSerializer(serializers.Serializer):
    offset = serializers.IntegerField(required = False, default = 0, min_value = 0)
    limit = serializers.IntegerField(required = False, default = 20, min_value = 1)
    pending = serializers.BooleanField(required = False, default = False)
    archived = serializers.BooleanField(required = False, default = False)