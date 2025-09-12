from django.core.management.base import BaseCommand

from ...models import Chat, Message, User

class Command(BaseCommand):
    help = "Create message for chat"

    def add_arguments(self, parser):
        parser.add_argument("--user-email", required = True)
        parser.add_argument("--chat-uuid", required = True)
        parser.add_argument("--message-text", required = True)
        parser.add_argument("--message-is-from-user", required = True)

    def handle(self, **options):
        user_email = options["user_email"]
        chat_uuid = options["chat_uuid"]
        message_text = options["message_text"]
        message_is_from_user = options["message_is_from_user"]

        user = User.objects.get(email = user_email)
        chat = Chat.objects.get(user = user, uuid = chat_uuid)
        Message.objects.create(chat = chat, text = message_text, is_from_user = message_is_from_user)