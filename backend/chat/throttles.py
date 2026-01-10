import hashlib
import os

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle

class DebugBypassThrottleMixin:
    def allow_request(self, request, view):
        if settings.DEBUG or os.getenv("DJANGO_TEST") == "True" or os.environ.get("PLAYWRIGHT_TEST") == "True":
            return True
        return super().allow_request(request, view)

class SignupRateThrottle(DebugBypassThrottleMixin, AnonRateThrottle):
    scope = "signup"

class RefreshRateThrottle(DebugBypassThrottleMixin, AnonRateThrottle):
    scope = "refresh"

class RefreshTokenRateThrottle(DebugBypassThrottleMixin, SimpleRateThrottle):
    scope = "refresh_token"

    def get_cache_key(self, request, view):
        token = request.data.get("refresh")
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return f"refresh_token:{token_hash}"

class MFATokenRateThrottle(DebugBypassThrottleMixin, SimpleRateThrottle):
    scope = "mfa_token"

    def get_cache_key(self, request, view):
        token = request.data.get("token")
        if not token:
            return None
        return f"mfa_token:{token}"

class IPEmailRateThrottle(DebugBypassThrottleMixin, AnonRateThrottle):
    scope = "ip_email"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)

        email = None
        if request.data:
            email = request.data.get("email")

        if email:
            ua = request.META.get("HTTP_USER_AGENT", "")
            return f"throttle_{self.scope}_{ident}_{email.lower()}_{hash(ua)}"
        else:
            return f"throttle_{self.scope}_{ident}"

class PerUserRateThrottle(DebugBypassThrottleMixin, UserRateThrottle):
    scope = "per_user"

    def allow_request(self, request, view):
        if not request.user.is_authenticated:
            return True
        return super().allow_request(request, view)

class PerUserIPRateThrottle(DebugBypassThrottleMixin, UserRateThrottle):
    scope = "per_user_ip"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = self.get_ident(request)
            user_id = request.user.pk
            return f"throttle_{self.scope}_user_{user_id}_ip_{ident}"
        return None