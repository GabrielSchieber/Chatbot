import uuid
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import validate_email
from django.db import models
from django.utils import timezone

from .totp_utils import generate_auth_url, generate_backup_codes, generate_secret, verify_secret

class UserManager(BaseUserManager):
    def create(self, email, password, is_staff = False, is_superuser = False):
        if email is None or password is None:
            raise ValueError("Both Email and Password fields must be set.")
        if type(email) != str or type(password) != str:
            raise ValueError("Both Email and Password fields must be of 'str' type.")

        try:
            validate_email(email)
        except:
            raise ValueError("Invalid email.")

        if len(password) < 12 or len(password) > 100:
            raise ValueError("Password must have between 12 and 100 characters.")

        user: User = self.model(email = self.normalize_email(email), is_staff = is_staff, is_superuser = is_superuser)
        user.set_password(password)
        user.save(using = self._db)

        UserPreferences.objects.create(user = user)
        UserMFA.objects.create(user = user)

        return user

    def create_superuser(self, email, password):
        return self.create(email, password, is_staff = True, is_superuser = True)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique = True)
    is_active = models.BooleanField(default = True)
    is_staff = models.BooleanField(default = False)
    created_at = models.DateTimeField(default = timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

class UserPreferences(models.Model):
    user = models.OneToOneField(User, models.CASCADE, related_name = "preferences")
    language = models.CharField(choices = [[c, c] for c in ["", "English", "Português"]], default = "")
    theme = models.CharField(choices = [[c, c] for c in ["System", "Light", "Dark"]], default = "System")
    has_sidebar_open = models.BooleanField(default = True)

    def __str__(self):
        return f"Preferences of {self.user} with {self.theme} theme and {"open" if self.has_sidebar_open else "closed"} sidebar"

class UserMFA(models.Model):
    user = models.OneToOneField(User, models.CASCADE, related_name = "mfa")
    secret = models.BinaryField(max_length = 32, db_column = "encrypted_secret")
    backup_codes = models.JSONField(default = list)
    is_enabled = models.BooleanField(default = False)

    def verify(self, code: str):
        if verify_secret(self.secret, code):
            return True
        else:
            for hashed_backup_code in self.backup_codes:
                if check_password(code, hashed_backup_code):
                    self.backup_codes.remove(hashed_backup_code)
                    self.save()
                    return True
        return False

    def setup(self):
        secret, encrypted_secret = generate_secret()
        self.secret = encrypted_secret
        self.save()
        auth_url = generate_auth_url(secret, self.user.email)
        return secret, auth_url

    def enable(self):
        backup_codes, hashed_backup_codes = generate_backup_codes()
        self.backup_codes = hashed_backup_codes
        self.is_enabled = True
        self.save()
        return backup_codes

    def disable(self):
        self.secret = bytes()
        self.backup_codes = []
        self.is_enabled = False
        self.save()

    def __str__(self):
        return f"{"Enabled" if self.is_enabled else "Disabled"} MFA settings of user {self.user} with {self.secret} secret and {self.backup_codes} backup codes"

class PreAuthToken(models.Model):
    token = models.UUIDField(default = uuid.uuid4, unique = True, editable = False)
    user = models.ForeignKey(User, models.CASCADE)
    created_at = models.DateTimeField(default = timezone.now)

    def is_expired(self):
        return timezone.now() - self.created_at > timedelta(minutes = 5)

class Chat(models.Model):
    user = models.ForeignKey(User, models.CASCADE, related_name = "chats")
    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    title = models.CharField(max_length = 200)
    pending_message = models.OneToOneField("Message", models.CASCADE, related_name = "pending_message", blank = True, null = True)
    is_archived = models.BooleanField(default = False)
    created_at = models.DateTimeField(auto_now_add = True)

    def last_modified_at(self):
        message: Message | None = self.messages.order_by("-last_modified_at").first()
        return message.last_modified_at if message else self.created_at

    def __str__(self):
        title = self.title if len(self.title) <= 20 else f"{self.title[:20]}..."
        return f"Chat of {self.user} titled {title} created at {self.created_at}"

class Message(models.Model):
    chat = models.ForeignKey(Chat, models.CASCADE, related_name = "messages")
    text = models.TextField()
    is_from_user = models.BooleanField()
    model = models.CharField(choices = [[c, c] for c in ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]], blank = True, null = True)
    last_modified_at = models.DateTimeField(default = timezone.now)
    created_at = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        text = self.text if len(self.text) <= 20 else f"{self.text[:20]}..."
        return f"Message of {"user" if self.is_from_user else "bot"} about {text} created at {self.created_at}"

class MessageFile(models.Model):
    message = models.ForeignKey(Message, models.CASCADE, related_name = "files")
    name = models.CharField(max_length = 200)
    content = models.BinaryField(max_length = 5_000_000)
    content_type = models.CharField(max_length = 100)
    created_at = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        return f"File {self.name} for message {self.message.id} in {self.message.chat.title} created at {self.message.created_at}"