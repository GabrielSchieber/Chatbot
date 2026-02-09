from drf_spectacular.utils import extend_schema_field, extend_schema_serializer, OpenApiExample
from rest_framework import serializers

from ..models import Message, MessageFile

class MessageFileSerializer(serializers.ModelSerializer):
    content = serializers.SerializerMethodField()
    content_size = serializers.SerializerMethodField()

    class Meta:
        model = MessageFile
        fields = ["id", "name", "content", "content_size", "content_type"]
        extra_kwargs = {
            "id": {"help_text": "ID of the file."},
            "name": {"help_text": "Name of the file."},
            "content_type": {"help_text": "MIME type of the file."},
        }

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_content(self, message_file: MessageFile):
        return None

    @extend_schema_field(serializers.IntegerField())
    def get_content_size(self, message_file: MessageFile):
        return len(message_file.content)

class MessageSerializer(serializers.ModelSerializer):
    files = MessageFileSerializer(many = True, read_only = True)

    class Meta:
        model = Message
        fields = ["id", "text", "is_from_user", "files", "model"]
        extra_kwargs = {
            "id": {"help_text": "ID of the message."},
            "text": {"help_text": "Content of the message."},
            "is_from_user": {"help_text": "True if sent by user, False if by AI."},
            "model": {"help_text": "AI model used for the response."},
        }

class GetMessageFileContentSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(help_text="UUID of the chat.")
    message_file_id = serializers.IntegerField(min_value = 1, help_text="ID of the file to retrieve.")

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            "New Message Example",
            value={
                "chat_uuid": "123e4567-e89b-12d3-a456-426614174000",
                "text": "Hello, can you help me with Python?",
                "model": "Qwen3-VL:4B"
            }
        )
    ]
)
class NewMessageSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(required = False, help_text="UUID of the chat (optional for new chats).")
    text = serializers.CharField(default = "", help_text="Message text content.")
    model = serializers.ChoiceField(Message.available_models(), default = "Qwen3-VL:4B", help_text="AI model to use.")
    files = serializers.ListField(child = serializers.FileField(max_length = MessageFile.max_content_size()), max_length = 10, default = [], help_text="List of files to upload.")
    temporary = serializers.BooleanField(default = False, help_text="If true, chat is not saved to history.")

    def validate_files(self, value: serializers.ListField):
        if sum([v.size for v in value]) > MessageFile.max_content_size():
            raise serializers.ValidationError(f"Total file size exceeds limit of {MessageFile.max_content_size_str()}.")
        return value

    def validate(self, attrs):
        if attrs["model"] == "Gemma3:1B":
            for f in attrs["files"]:
                if "image" in f.content_type:
                    raise serializers.ValidationError("Image file inputs are only supported with the Qwen3-VL:4B model.")
        return attrs

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            "Edit Message Example",
            value={
                "chat_uuid": "123e4567-e89b-12d3-a456-426614174000",
                "index": 0,
                "text": "Hello, can you help me with Django?",
                "model": "Qwen3-VL:4B"
            }
        )
    ]
)
class EditMessageSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(help_text="UUID of the chat.")
    index = serializers.IntegerField(min_value = 0, help_text="Index of the message to edit.")
    text = serializers.CharField(default = "", help_text="New text content.")
    model = serializers.ChoiceField(Message.available_models(), default = "Qwen3-VL:4B", help_text="AI model to use.")
    added_files = serializers.ListField(child = serializers.FileField(max_length = MessageFile.max_content_size()), max_length = 10, default = [], help_text="New files to add.")
    removed_file_ids = serializers.ListField(child = serializers.IntegerField(min_value = 1), default = [], help_text="IDs of files to remove.")

    def validate(self, attrs):
        if attrs["model"] == "Gemma3:1B":
            for f in attrs["added_files"]:
                if "image" in f.content_type:
                    raise serializers.ValidationError("Image file inputs are only supported with the Qwen3-VL:4B model.")
        return attrs

@extend_schema_serializer(
    examples=[
        OpenApiExample(
            "Regenerate Message Example",
            value={
                "chat_uuid": "123e4567-e89b-12d3-a456-426614174000",
                "index": 1,
                "model": "Qwen3-VL:4B"
            }
        )
    ]
)
class RegenerateMessageSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(help_text="UUID of the chat.")
    index = serializers.IntegerField(min_value = 0, help_text="Index of the message to regenerate.")
    model = serializers.ChoiceField(Message.available_models(), default = "Qwen3-VL:4B", help_text="AI model to use.")