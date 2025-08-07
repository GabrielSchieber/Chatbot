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
    date_joined = models.DateTimeField(default = timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

class Chat(models.Model):
    user = models.ForeignKey(User, on_delete = models.CASCADE)
    title = models.TextField()
    is_complete = models.BooleanField(default = True)
    date_time = models.DateTimeField(auto_now_add = True)
    uuid = models.UUIDField(primary_key = True, default = uuid.uuid4, editable = False)

    def __str__(self):
        title = self.title if len(self.title) <= 20 else f"{self.title[:20]}..."
        return f"Chat of {self.user} titled {title} at {self.date_time}"

class Message(models.Model):
    chat = models.ForeignKey(Chat, related_name = "messages", on_delete = models.CASCADE)
    text = models.TextField()
    is_user_message = models.BooleanField()
    date_time = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        owner = "user" if self.is_user_message else "bot"
        text = self.text if len(self.text) <= 20 else f"{self.text[:20]}..."
        return f"Message of {owner} about {text} at {self.date_time}"

class MessageFile(models.Model):
    message = models.ForeignKey(Message, related_name = "files", on_delete = models.CASCADE)
    file = models.FileField(upload_to = "chat_files/")
    name = models.TextField()

    def __str__(self):
        return f"File {self.name} for message {self.message.id} at {self.date_time}"