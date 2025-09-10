from django.core.management.base import BaseCommand

from ...models import User

class Command(BaseCommand):
    help = "Create user with email and password"

    def add_arguments(self, parser):
        parser.add_argument("--email", required = True)
        parser.add_argument("--password", required = True)

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]

        User.objects.create_user(email = email, password = password)