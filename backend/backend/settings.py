import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY environment variable must be defined.")

DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",")

INSTALLED_APPS = ["chat", "daphne"]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [] if DEBUG else ["dist"],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []}
    }
]

ASGI_APPLICATION = "backend.asgi.application"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [["redis", "6379"]]}
    }
}