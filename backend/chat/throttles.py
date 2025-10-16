from rest_framework.throttling import AnonRateThrottle

class SignupRateThrottle(AnonRateThrottle):
    scope = "signup"

class LoginRateThrottle(AnonRateThrottle):
    scope = "login"

class VerifyMFARateThrottle(AnonRateThrottle):
    scope = "verify_mfa"

class RefreshRateThrottle(AnonRateThrottle):
    scope = "refresh"