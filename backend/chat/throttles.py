from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

class SignupRateThrottle(AnonRateThrottle):
    scope = "signup"

class RefreshRateThrottle(AnonRateThrottle):
    scope = "refresh"

class IPEmailRateThrottle(AnonRateThrottle):
    """
    Rate limits based on both the client IP and a user-supplied email (if present).
    Prevents brute-forcing many accounts from one IP.
    """
    scope = "ip_email"

    def get_cache_key(self, request, view):
        # 1. Get the client IP (the same logic DRF uses)
        ident = self.get_ident(request)

        # 2. Try to extract the email from request data
        email = None
        if request.data:
            email = request.data.get("email")

        # 3. Combine both; lowercasing the email to avoid duplicates
        if email:
            ua = request.META.get("HTTP_USER_AGENT", "")
            return f"throttle_{self.scope}_{ident}_{email.lower()}_{hash(ua)}"
        else:
            # fallback to IP-only throttling
            return f"throttle_{self.scope}_{ident}"

class PerUserRateThrottle(UserRateThrottle):
    scope = "per_user"

    def allow_request(self, request, view):
        # Only throttle authenticated users; skip anonymous requests
        if not request.user.is_authenticated:
            return True
        return super().allow_request(request, view)

class PerUserIPRateThrottle(UserRateThrottle):
    """
    Throttle keyed by both user ID and IP address.
    Prevents users from bypassing limits using multiple IPs or sessions.
    """
    scope = "per_user_ip"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = self.get_ident(request)  # IP detection (uses X-Forwarded-For if available)
            user_id = request.user.pk
            return f"throttle_{self.scope}_user_{user_id}_ip_{ident}"
        return None  # only throttles authenticated users