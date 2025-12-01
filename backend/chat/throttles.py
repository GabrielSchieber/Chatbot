import os
import sys

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

class DebugBypassThrottleMixin:
    def allow_request(self, request, view):
        if settings.DEBUG or "test" in sys.argv or os.environ.get("PLAYWRIGHT_TEST") == "True":
            return True
        return super().allow_request(request, view)

class SignupRateThrottle(DebugBypassThrottleMixin, AnonRateThrottle):
    scope = "signup"

class RefreshRateThrottle(DebugBypassThrottleMixin, AnonRateThrottle):
    scope = "refresh"

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