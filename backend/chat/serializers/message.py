from rest_framework import serializers

from ..models import Message, MessageFile

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

class GetMessageFileContentSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField()
    message_file_id = serializers.IntegerField(min_value = 1)

class NewMessageSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField(required = False)
    text = serializers.CharField(default = "")
    model = serializers.ChoiceField(Message.available_models(), default = "Qwen3-VL:4B")
    files = serializers.ListField(child = serializers.FileField(max_length = MessageFile.max_content_size()), max_length = 10, default = [])
    temporary = serializers.BooleanField(default = False)

    def validate_files(self, value: serializers.ListField):
        if sum([v.size for v in value]) > MessageFile.max_content_size():
            raise serializers.ValidationError(f"Total file size exceeds limit of {MessageFile.max_content_size_str()}.")
        return value

class EditMessageSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField()
    index = serializers.IntegerField(min_value = 0)
    text = serializers.CharField(default = "")
    model = serializers.ChoiceField(Message.available_models(), default = "Qwen3-VL:4B")
    added_files = serializers.ListField(child = serializers.FileField(max_length = MessageFile.max_content_size()), max_length = 10, default = [])
    removed_file_ids = serializers.ListField(child = serializers.IntegerField(min_value = 1), default = [])

class RegenerateMessageSerializer(serializers.Serializer):
    chat_uuid = serializers.UUIDField()
    index = serializers.IntegerField(min_value = 0)
    model = serializers.ChoiceField(Message.available_models(), default = "Qwen3-VL:4B")