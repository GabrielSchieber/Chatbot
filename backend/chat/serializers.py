from rest_framework import serializers

from .models import Chat, Message, MessageFile, User

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only = True)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(email = validated_data["email"], password = validated_data["password"])

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "theme", "has_sidebar_open"]

class ChatSerializer(serializers.ModelSerializer):
    pending_message_id = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ["title", "pending_message_id", "uuid"]

    def get_pending_message_id(self, chat: Chat):
        return chat.pending_message.id if chat.pending_message is not None else None

class MessageFileSerializer(serializers.ModelSerializer):
    content_size = serializers.SerializerMethodField()

    class Meta:
        model = MessageFile
        fields = ["id", "name", "content_size", "content_type"]

    def get_content_size(self, message_file: MessageFile):
        return len(message_file.content)

class MessageSerializer(serializers.ModelSerializer):
    files = MessageFileSerializer(many = True, read_only = True)

    class Meta:
        model = Message
        fields = ["id", "text", "is_from_user", "files", "model"]