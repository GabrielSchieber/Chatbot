import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

class UserManager(BaseUserManager):
    def create_user(self, email, password, **extra_fields):
        if not email or not password:
            raise ValueError("Both Email and Password fields must be set")
        email = self.normalize_email(email)
        user = self.model(email = email, **extra_fields)
        user.set_password(password)
        user.save(using = self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff = True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser = True.")

        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique = True)
    is_active = models.BooleanField(default = True)
    is_staff = models.BooleanField(default = False)
    theme = models.CharField(max_length = 6, choices = [["System", "System"], ["Light", "Light"], ["Dark", "Dark"]], default = "Light")
    has_sidebar_open = models.BooleanField(default = True)
    created_at = models.DateTimeField(default = timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

class Chat(models.Model):
    user = models.ForeignKey(User, models.CASCADE, related_name = "chats")
    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)
    title = models.CharField(max_length = 200)
    is_pending = models.BooleanField(default = False)
    created_at = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        title = self.title if len(self.title) <= 20 else f"{self.title[:20]}..."
        return f"Chat of {self.user} titled {title} created at {self.created_at}"

class Message(models.Model):
    chat = models.ForeignKey(Chat, models.CASCADE, related_name = "messages")
    text = models.TextField()
    role = models.CharField(max_length = 4, choices = [["User", "User"], ["Bot", "Bot"]])
    model = models.CharField(
        max_length = 12,
        choices = [
            ["SmolLM2-135M", "SmolLM2-135M"],
            ["SmolLM2-360M", "SmolLM2-360M"],
            ["SmolLM2-1.7B", "SmolLM2-1.7B"],
            ["Moondream", "Moondream"]
        ],
        blank = True,
        null = True
    )
    created_at = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        text = self.text if len(self.text) <= 20 else f"{self.text[:20]}..."
        return f"Message of {self.role.lower()} about {text} created at {self.created_at}"

class MessageFile(models.Model):
    message = models.ForeignKey(Message, models.CASCADE, related_name = "files")
    name = models.CharField(max_length = 200)
    content = models.BinaryField()
    content_type = models.TextField(max_length = 100)
    created_at = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        return f"File {self.name} for message {self.message.id} in {self.message.chat.title} created at {self.message.created_at}"