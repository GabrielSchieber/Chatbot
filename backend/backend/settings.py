import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"

ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

INSTALLED_APPS = ["chat", "daphne"]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [] if DEBUG else ["dist"]}]

ASGI_APPLICATION = "backend.asgi.application"

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"