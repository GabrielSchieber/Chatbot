import os
from datetime import timedelta

def get_env(key: str):
    value = os.getenv(key)
    if value is None:
        raise RuntimeError(f"'{key}' environment variable must be defined.")
    return value

def get_secret(path_key: str):
    with open(get_env(path_key)) as file:
        return file.read()

match get_env("ENVIRONMENT"):
    case "Development":
        SECRET_KEY = "123"
        TOTP_ENCRYPTION_KEY = "1111111111111111111111111111111111111111111="

        DEBUG = True
        ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
        SECURE_SSL_REDIRECT = False

        EMAIL_HOST = "mailpit"
        EMAIL_PORT = 1025
        EMAIL_USE_TLS = False
        EMAIL_USE_SSL = False
        DEFAULT_FROM_EMAIL = "Chatbot <no-reply@localhost>"
        BASE_EMAIL_URL = "http://localhost:5173"

        POSTGRES_DB = get_env("POSTGRES_DB")
        POSTGRES_USER = get_env("POSTGRES_USER")
        POSTGRES_PASSWORD = get_env("POSTGRES_PASSWORD")
    case "Staging":
        SECRET_KEY = "123"
        TOTP_ENCRYPTION_KEY = "1111111111111111111111111111111111111111111="

        DEBUG = False
        ALLOWED_HOSTS = ["127.0.0.1"]
        SECURE_SSL_REDIRECT = True

        EMAIL_HOST = "mailpit"
        EMAIL_PORT = 1025
        EMAIL_USE_TLS = False
        EMAIL_USE_SSL = False
        DEFAULT_FROM_EMAIL = "Chatbot <no-reply@localhost>"
        BASE_EMAIL_URL = "https://127.0.0.1"

        POSTGRES_DB = get_env("POSTGRES_DB")
        POSTGRES_USER = get_env("POSTGRES_USER")
        POSTGRES_PASSWORD = get_env("POSTGRES_PASSWORD")
    case "Production":
        SECRET_KEY = get_secret("SECRET_KEY_PATH")
        TOTP_ENCRYPTION_KEY = get_secret("TOTP_ENCRYPTION_KEY_PATH")

        DEBUG = False
        ALLOWED_HOSTS = ["example.com"]
        SECURE_SSL_REDIRECT = True

        EMAIL_HOST = "smtp.example.com"
        EMAIL_HOST_USER = get_secret("EMAIL_HOST_USER_PATH")
        EMAIL_HOST_PASSWORD = get_secret("EMAIL_HOST_PASSWORD_PATH")
        EMAIL_PORT = 587
        EMAIL_USE_TLS = True
        EMAIL_USE_SSL = False
        DEFAULT_FROM_EMAIL = "Chatbot <no-reply@example.com>"
        BASE_EMAIL_URL = "https://example.com"

        POSTGRES_DB = get_secret("POSTGRES_DB_PATH")
        POSTGRES_USER = get_secret("POSTGRES_USER_PATH")
        POSTGRES_PASSWORD = get_secret("POSTGRES_PASSWORD_PATH")
    case _:
        raise RuntimeError(f"Invalid value for 'ENVIRONMENT' environment variable.")

ROOT_URLCONF = "backend.urls"
ASGI_APPLICATION = "backend.asgi.application"

AUTH_USER_MODEL = "chat.User"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

INSTALLED_APPS = [
    "chat",
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework_simplejwt.token_blacklist"
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "chat.middleware.RequestInfoMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "chat.middleware.JWTAuthCookieMiddleware"
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages"
            ]
        }
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": POSTGRES_DB,
        "USER": POSTGRES_USER,
        "PASSWORD": POSTGRES_PASSWORD,
        "HOST": "postgres",
        "PORT": "5432"
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://redis:6379"
    }
}

STATIC_URL = "static/"
STATIC_ROOT = "static"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

LOCALE_PATHS = ["locale"]

LANGUAGES = [
    ("en-us", "English (US)"),
    ("pt-br", "Português (Brasil)")
]

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [["redis", "6379"]]
        }
    }
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_THROTTLE_CLASSES": [] if DEBUG else [
        "chat.throttles.PerUserRateThrottle",
        "chat.throttles.PerUserIPRateThrottle",
        "rest_framework.throttling.AnonRateThrottle"
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "10/minute",
        "per_user": "100/minute",
        "per_user_ip": "60/minute",
        "signup": "3/minute",
        "refresh": "20/minute",
        "refresh_token": "10/minute",
        "mfa_token": "5/minute",
        "message": "20/hours",
        "ip_email": "5/minute" 
    }
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes = 5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days = 7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_REFRESH": "refresh_token",
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SECURE": True,
    "AUTH_COOKIE_SAMESITE": "Strict"
}