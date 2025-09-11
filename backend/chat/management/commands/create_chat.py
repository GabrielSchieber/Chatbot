from django.core.management.base import BaseCommand

from chat.models import Chat, User

class Command(BaseCommand):
    help = "Create chat for user"

    def add_arguments(self, parser):
        parser.add_argument("--user-email", required = True)
        parser.add_argument("--chat-title", required = True)

    def handle(self, *args, **options):
        user_email = options["user_email"]
        chat_title = options["chat_title"]

        user = User.objects.get(email = user_email)
        chat = Chat.objects.create(user = user, title = chat_title)

        self.stdout.write(self.style.SUCCESS(str(chat.uuid)))