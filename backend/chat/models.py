import secrets
import uuid
from datetime import timedelta

import pyotp
from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import validate_email
from django.db import models
from django.db.models.manager import BaseManager
from django.utils import timezone

class ValidatingQuerySet(models.QuerySet):
    def bulk_create(self, objs, **kwargs):
        for obj in objs:
            obj.full_clean()
        return super().bulk_create(objs, **kwargs)

    def bulk_update(self, objs, fields, **kwargs):
        for obj in objs:
            obj.full_clean()
        return super().bulk_update(objs, fields, **kwargs)

class ValidatingManager(models.Manager):
    def get_queryset(self):
        return ValidatingQuerySet(self.model, using = self._db)

    def bulk_create(self, objs, **kwargs):
        return self.get_queryset().bulk_create(objs, **kwargs)

    def bulk_update(self, objs, fields, **kwargs):
        return self.get_queryset().bulk_update(objs, fields, **kwargs)

class CleanOnSaveMixin(models.Model):
    objects = ValidatingManager()

    class Meta:
        abstract = True

    def save(self, *args, validate = True, **kwargs):
        if validate:
            self.full_clean()
        return super().save(*args, **kwargs)

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

class User(CleanOnSaveMixin, AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique = True)
    is_active = models.BooleanField(default = True)
    is_staff = models.BooleanField(default = False)
    created_at = models.DateTimeField(auto_now_add = True)

    objects: UserManager = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    chats: BaseManager[Chat]
    preferences: UserPreferences
    mfa: UserMFA
    sessions: BaseManager[UserSession]

    def __str__(self):
        return f"User with email {self.email} created at {self.created_at}."

class UserPreferences(CleanOnSaveMixin, models.Model):
    user = models.OneToOneField(User, models.CASCADE, related_name = "preferences")

    language = models.CharField(blank = True, default = "", choices = [[c, c] for c in ["", "English", "Português"]])
    theme = models.CharField(default = "System", choices = [[c, c] for c in ["System", "Light", "Dark"]])

    has_sidebar_open = models.BooleanField(default = True)

    custom_instructions = models.CharField(max_length = 1000, blank = True)
    nickname = models.CharField(max_length = 50, blank = True)
    occupation = models.CharField(max_length = 50, blank = True)
    about = models.CharField(max_length = 1000, blank = True)

    @staticmethod
    def available_languages() -> list[str]:
        return [c[0] for c in UserPreferences._meta.get_field("language").choices]

    @staticmethod
    def available_themes() -> list[str]:
        return [c[0] for c in UserPreferences._meta.get_field("theme").choices]

    def __str__(self):
        return f"Preferences for {self.user.email}."

class UserMFA(CleanOnSaveMixin, models.Model):
    user = models.OneToOneField(User, models.CASCADE, related_name = "mfa")
    secret = models.BinaryField(max_length = 140)
    backup_codes = models.JSONField(default = list, blank = True)
    is_enabled = models.BooleanField(default = False)

    def verify(self, code: str):
        if type(code) != str:
            return False
        elif len(code) == 6:
            return UserMFA.verify_secret(self.secret, code)
        elif len(code) == 12:
            for hashed_backup_code in self.backup_codes:
                if check_password(code, hashed_backup_code):
                    self.backup_codes.remove(hashed_backup_code)
                    self.save()
                    return True
        return False

    def setup(self):
        secret, encrypted_secret = UserMFA.generate_secret()
        self.secret = encrypted_secret
        self.save()
        auth_url = UserMFA.generate_auth_url(secret, self.user.email)
        return secret, auth_url

    def enable(self):
        backup_codes, hashed_backup_codes = UserMFA.generate_backup_codes()
        self.backup_codes = hashed_backup_codes
        self.is_enabled = True
        self.save()
        return backup_codes

    def disable(self):
        self.secret = bytes()
        self.backup_codes = []
        self.is_enabled = False
        self.save()

    @staticmethod
    def get_cipher():
        return Fernet(settings.TOTP_ENCRYPTION_KEY.encode())

    @staticmethod
    def encrypt_secret(secret: str):
        return UserMFA.get_cipher().encrypt(secret.encode())

    @staticmethod
    def decrypt_secret(encrypted_secret: bytes) -> str:
        return UserMFA.get_cipher().decrypt(encrypted_secret).decode()

    @staticmethod
    def verify_secret(encrypted_secret: bytes, code: str):
        return pyotp.TOTP(UserMFA.decrypt_secret(encrypted_secret)).verify(code, valid_window = 1)

    @staticmethod
    def generate_code(encrypted_secret: bytes):
        return pyotp.TOTP(UserMFA.decrypt_secret(encrypted_secret)).now()

    @staticmethod
    def generate_secret():
        secret = pyotp.random_base32()
        encrypted_secret = UserMFA.encrypt_secret(secret)
        return secret, encrypted_secret

    @staticmethod
    def generate_auth_url(secret: str, email: str):
        return pyotp.totp.TOTP(secret).provisioning_uri(email, "Chatbot")

    @staticmethod
    def generate_backup_codes():
        backup_codes = [secrets.token_hex(6).upper() for _ in range(10)]
        hashed_backup_codes = [make_password(code) for code in backup_codes]
        return backup_codes, hashed_backup_codes

    def __str__(self):
        return f"MFA for {self.user.email}."

class UserSession(CleanOnSaveMixin, models.Model):
    class Meta:
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"

    user = models.ForeignKey(User, models.CASCADE, related_name = "sessions")
    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)

    login_at = models.DateTimeField(auto_now_add = True)
    logout_at = models.DateTimeField(blank = True, null = True)

    ip_address = models.GenericIPAddressField(blank = True, null = True)
    user_agent = models.CharField(max_length = 200, blank = True)
    device = models.CharField(max_length = 200, blank = True)
    browser = models.CharField(max_length = 200, blank = True)
    os = models.CharField(max_length = 200, blank = True)

    refresh_jti = models.CharField(max_length = 255, blank = True)

    def __str__(self):
        return f"Session created at {self.login_at} for {self.user.email}."

class PreAuthToken(CleanOnSaveMixin, models.Model):
    user = models.ForeignKey(User, models.CASCADE, related_name = "pre_auth_tokens")
    token = models.UUIDField(unique = True, default = uuid.uuid4, editable = False)
    created_at = models.DateTimeField(auto_now_add = True)

    def is_expired(self):
        return timezone.now() - self.created_at > timedelta(minutes = 5)

    def __str__(self):
        return f"Pre-authentication token created at {self.created_at} owned by {self.user.email}."

class Chat(CleanOnSaveMixin, models.Model):
    user = models.ForeignKey(User, models.CASCADE, related_name = "chats")
    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    title = models.CharField(max_length = 200)
    pending_message: Message | None = models.OneToOneField("Message", models.CASCADE, related_name = "pending_message", blank = True, null = True)
    is_archived = models.BooleanField(default = False)
    is_temporary = models.BooleanField(default = False)
    created_at = models.DateTimeField(auto_now_add = True)

    messages: BaseManager[Message]

    def last_modified_at(self):
        message: Message | None = self.messages.order_by("-last_modified_at").first()
        return message.last_modified_at if message else self.created_at

    def __str__(self):
        return f"Chat titled {self.title} created at {self.created_at} owned by {self.user.email}."

class Message(CleanOnSaveMixin, models.Model):
    chat = models.ForeignKey(Chat, models.CASCADE, related_name = "messages")
    text = models.TextField(blank = True)
    is_from_user = models.BooleanField()
    model = models.CharField(blank = True, choices = [[c, c] for c in ["", "SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]])
    last_modified_at = models.DateTimeField(auto_now = True)
    created_at = models.DateTimeField(auto_now_add = True)

    files: BaseManager[MessageFile]

    @staticmethod
    def available_models() -> list[str]:
        return [c[0] for c in Message._meta.get_field("model").choices]

    def __str__(self):
        return f"Message created at {self.created_at} in {self.chat.title} owned by {self.chat.user.email}."

class MessageFile(CleanOnSaveMixin, models.Model):
    message = models.ForeignKey(Message, models.CASCADE, related_name = "files")
    name = models.CharField(max_length = 200)
    content = models.BinaryField(max_length = 5_000_000)
    content_type = models.CharField(max_length = 100)
    created_at = models.DateTimeField(auto_now_add = True)

    @staticmethod
    def max_content_size() -> int:
        return MessageFile._meta.get_field("content").max_length

    @staticmethod
    def max_content_size_str() -> str:
        return "5 MB"

    def __str__(self):
        return f"File of message named {self.name} created at {self.created_at} in {self.message} owned by {self.message.chat.user.email}."