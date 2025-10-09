import json
import sys

from django.contrib.auth import get_user_model
from django.core import serializers
from django.core.management.base import BaseCommand

from ...models import Chat, Message

User = get_user_model()

class Command(BaseCommand):
    help = "Convert custom JSON into a Django fixture JSON"

    def add_arguments(self, parser):
        parser.add_argument("input", type = str, help = "Input JSON file")
        parser.add_argument("-o", "--output", type = str, help = "Output file (default: stdout)", default = None)

    def handle(self, *args, **options):
        input_file = options["input"]
        output_file = options["output"]

        with open(input_file) as f:
            data = json.load(f)

        created_objects = []

        for user_data in data.get("users", []):
            user = User.objects.create_user(email = user_data["email"], password = user_data["password"])
            created_objects.append(user)

            for chat_data in user_data.get("chats", []):
                chat = Chat.objects.create(user = user, title = chat_data["title"])
                created_objects.append(chat)

                for message in chat_data.get("messages", []):
                    message = Message.objects.create(
                        chat = chat,
                        text = message["text"],
                        is_from_user = message["is_from_user"],
                        model = message.get("model")
                    )
                    created_objects.append(message)

        fixture_json = serializers.serialize("json", created_objects, indent = 4)

        if output_file:
            with open(output_file, "w") as f:
                f.write(fixture_json)
        else:
            sys.stdout.write(fixture_json)