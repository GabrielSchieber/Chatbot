import uuid
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import validate_email
from django.db import models
from django.db.models.manager import BaseManager
from django.utils import timezone

from .totp_utils import generate_auth_url, generate_backup_codes, generate_secret, verify_secret

class UserManager(BaseUserManager):
    def create_user(self, email: str, password: str, is_staff: bool = False, is_superuser: bool = False):
        try:
            validate_email(email)
        except:
            raise ValueError("Email address is invalid.")

        if len(password) < 12 or len(password) > 1000:
            raise ValueError("Password must have between 12 and 1000 characters.")

        if User.objects.filter(email = email).exists():
            raise ValueError("Email is already registered.")

        user: User = self.model(email = self.normalize_email(email), is_staff = is_staff, is_superuser = is_superuser)
        user.set_password(password)
        user.save(using = self._db)

        UserPreferences.objects.create(user = user)
        UserMFA.objects.create(user = user)

        return user

    def create_superuser(self, email: str, password: str):
        return self.create_user(email, password, is_staff = True, is_superuser = True)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique = True)
    is_active = models.BooleanField(default = True)
    is_staff = models.BooleanField(default = False)
    created_at = models.DateTimeField(auto_now_add = True)

    objects: UserManager = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    chats: BaseManager[Chat]
    mfa: UserMFA
    preferences: UserPreferences

    def __str__(self):
        return ""

class UserPreferences(models.Model):
    user = models.OneToOneField(User, models.CASCADE, related_name = "preferences")
    language = models.CharField(choices = [[c, c] for c in ["", "English", "Português"]], default = "")
    theme = models.CharField(choices = [[c, c] for c in ["System", "Light", "Dark"]], default = "System")
    has_sidebar_open = models.BooleanField(default = True)
    custom_instructions = models.CharField(max_length = 1000)
    nickname = models.CharField(max_length = 50)
    occupation = models.CharField(max_length = 50)
    about = models.CharField(max_length = 1000)

class UserMFA(models.Model):
    user = models.OneToOneField(User, models.CASCADE, related_name = "mfa")
    secret = models.BinaryField(max_length = 32)
    backup_codes = models.JSONField(default = list)
    is_enabled = models.BooleanField(default = False)

    def verify(self, code: str):
        if type(code) != str:
            return False
        elif len(code) == 6:
            return verify_secret(self.secret, code)
        elif len(code) == 12:
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

class UserSession(models.Model):
    class Meta:
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"

    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    user = models.ForeignKey(User, models.CASCADE, related_name = "sessions")

    login_at = models.DateTimeField(auto_now_add = True)
    logout_at = models.DateTimeField(blank = True, null = True)

    ip_address = models.GenericIPAddressField(blank = True, null = True)
    user_agent = models.TextField(blank = True, null = True)
    device = models.CharField(max_length = 200, blank = True, null = True)
    browser = models.CharField(max_length = 200, blank = True, null = True)
    os = models.CharField(max_length = 200, blank = True, null = True)

    refresh_jti = models.CharField(max_length = 255, blank = True, null = True)

    def __str__(self):
        return f"{self.user.email} @ {self.login_at}"

class PreAuthToken(models.Model):
    user = models.ForeignKey(User, models.CASCADE)
    token = models.UUIDField(unique = True, default = uuid.uuid4, editable = False)
    created_at = models.DateTimeField(auto_now_add = True)

    def is_expired(self):
        return timezone.now() - self.created_at > timedelta(minutes = 5)

class Chat(models.Model):
    user = models.ForeignKey(User, models.CASCADE, related_name = "chats")
    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    title = models.CharField(max_length = 200)
    pending_message: Message | None = models.OneToOneField("Message", models.CASCADE, related_name = "pending_message", blank = True, null = True)
    is_archived = models.BooleanField(default = False)
    created_at = models.DateTimeField(auto_now_add = True)

    messages: BaseManager[Message]

    def last_modified_at(self):
        message: Message | None = self.messages.order_by("-last_modified_at").first()
        return message.last_modified_at if message else self.created_at

    def __str__(self):
        return ""

class Message(models.Model):
    chat = models.ForeignKey(Chat, models.CASCADE, related_name = "messages")
    text = models.TextField()
    is_from_user = models.BooleanField()
    model = models.CharField(choices = [[c, c] for c in ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]], blank = True, null = True)
    last_modified_at = models.DateTimeField(auto_now = True)
    created_at = models.DateTimeField(auto_now_add = True)

    files: BaseManager[MessageFile]

    def __str__(self):
        return ""

class MessageFile(models.Model):
    message = models.ForeignKey(Message, models.CASCADE, related_name = "files")
    name = models.CharField(max_length = 200)
    content = models.BinaryField(max_length = 5_000_000)
    content_type = models.CharField(max_length = 100)
    created_at = models.DateTimeField(auto_now_add = True)