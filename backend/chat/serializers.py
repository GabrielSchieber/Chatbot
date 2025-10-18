from rest_framework import serializers

from .models import Chat, Message, MessageFile, User, UserMFA, UserPreferences

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only = True)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(email = validated_data["email"], password = validated_data["password"])

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ["theme", "has_sidebar_open"]

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
        fields = ["uuid", "title", "pending_message_id", "index"]

    def get_pending_message_id(self, chat: Chat):
        return chat.pending_message.id if chat.pending_message is not None else None

    def get_index(self, chat: Chat):
        for i, c in enumerate(chat.user.chats.order_by("-created_at")):
            if c == chat:
                return i

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