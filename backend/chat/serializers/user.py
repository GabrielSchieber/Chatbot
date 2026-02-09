import unicodedata

from drf_spectacular.utils import extend_schema_field, extend_schema_serializer, OpenApiExample
from rest_framework import serializers

from ..models import User, UserMFA, UserPreferences, UserSession

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ["language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about"]
        extra_kwargs = {
            "language": {"help_text": "Preferred language."},
            "theme": {"help_text": "UI theme preference (System, Light, Dark)."},
            "has_sidebar_open": {"help_text": "Whether the sidebar is open by default."},
            "custom_instructions": {"help_text": "Custom instructions for the AI."},
            "nickname": {"help_text": "User's nickname."},
            "occupation": {"help_text": "User's occupation."},
            "about": {"help_text": "About the user."},
        }

class UserMFASerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMFA
        fields = ["is_enabled"]
        extra_kwargs = {
            "is_enabled": {"help_text": "Whether MFA is enabled for the user."}
        }

class UserSessionSerializer(serializers.ModelSerializer):
    login_at = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = ["login_at", "logout_at", "ip_address", "browser", "os"]
        extra_kwargs = {
            "logout_at": {"help_text": "Timestamp when the session ended."},
            "ip_address": {"help_text": "IP address of the session."},
            "browser": {"help_text": "Browser used for the session."},
            "os": {"help_text": "Operating system used for the session."},
        }

    @extend_schema_field(serializers.CharField())
    def get_login_at(self, session: UserSession):
        return str(session.login_at)

class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(many = False, read_only = True)
    mfa = UserMFASerializer(many = False, read_only = True)
    sessions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["email", "is_guest", "preferences", "mfa", "sessions"]
        extra_kwargs = {
            "email": {"help_text": "User's email address."},
            "is_guest": {"help_text": "Whether the user is a guest account."},
        }

    @extend_schema_field(UserSessionSerializer(many=True))
    def get_sessions(self, user: User):
        active_sessions = user.sessions.filter(logout_at__isnull = True).count()
        sessions = user.sessions.order_by("-login_at")[:active_sessions + 5]
        return UserSessionSerializer(sessions, many = True).data

@extend_schema_serializer(
    examples=[
        OpenApiExample("Signup Example", value={"email": "user@example.com", "password": "StrongPassword123!"})
    ]
)
class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email address for registration.")
    password = serializers.CharField(min_length = 12, max_length = 1000, trim_whitespace = False, help_text="Password (min 12 chars).")

    def validate_password(self, value: serializers.CharField):
        for c in value:
            if unicodedata.category(c) == "Cc":
                raise serializers.ValidationError("Password cannot contain control characters.")
        return value

class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email address to verify.")
    token = serializers.CharField(help_text="Verification token sent via email.")

@extend_schema_serializer(
    examples=[
        OpenApiExample("Login Example", value={"email": "user@example.com", "password": "StrongPassword123!"})
    ]
)
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="User's email address.")
    password = serializers.CharField(help_text="User's password.")

class SetupMFASerializer(serializers.Serializer):
    password = serializers.CharField(help_text="Current password to confirm identity.")

class VerifyMFASerializer(serializers.Serializer):
    token = serializers.CharField(help_text="Temporary token received during login.")
    code = serializers.CharField(help_text="MFA code from authenticator app.")

class MeSerializer(serializers.Serializer):
    language = serializers.ChoiceField(UserPreferences.available_languages(), required = False, help_text="Preferred language.")
    theme = serializers.ChoiceField(UserPreferences.available_themes(), required = False, help_text="UI theme.")
    has_sidebar_open = serializers.BooleanField(required = False, help_text="Sidebar state.")
    custom_instructions = serializers.CharField(allow_blank = True, max_length = 1000, required = False, help_text="Custom AI instructions.")
    nickname = serializers.CharField(allow_blank = True, max_length = 50, required = False, help_text="User nickname.")
    occupation = serializers.CharField(allow_blank = True, max_length = 50, required = False, help_text="User occupation.")
    about = serializers.CharField(allow_blank = True, max_length = 1000, required = False, help_text="About text.")

@extend_schema_serializer(
    examples=[
        OpenApiExample("Request Password Reset Example", value={"email": "user@example.com"})
    ]
)
class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email address to request password reset for.")

@extend_schema_serializer(
    examples=[
        OpenApiExample("Confirm Password Reset Example", value={"token": "reset_token_123", "password": "NewStrongPassword123!"})
    ]
)
class ConfirmPasswordResetSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="Password reset token.")
    password = serializers.CharField(min_length = 12, max_length = 1000, help_text="New password.")

class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(help_text="Current password to confirm deletion.")
    mfa_code = serializers.CharField(required = False, allow_blank = True, help_text="MFA code if enabled.")

class AuthenticateAsGuestSerializer(serializers.Serializer):
    guest_token = serializers.CharField(required = False, help_text="Existing guest token to restore session.")