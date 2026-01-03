from rest_framework import serializers

from ..models import User, UserMFA, UserPreferences, UserSession

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ["language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about"]

class UserMFASerializer(serializers.ModelSerializer):
    class Meta:
        model = UserMFA
        fields = ["is_enabled"]

class UserSessionSerializer(serializers.ModelSerializer):
    login_at = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = ["login_at", "logout_at", "ip_address", "browser", "os"]

    def get_login_at(self, session: UserSession):
        return str(session.login_at)

class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(many = False, read_only = True)
    mfa = UserMFASerializer(many = False, read_only = True)
    sessions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["email", "preferences", "mfa", "sessions"]

    def get_sessions(self, user: User):
        active_sessions = user.sessions.filter(logout_at__isnull = True).count()
        sessions = user.sessions.order_by("-login_at")[:active_sessions + 5]
        return UserSessionSerializer(sessions, many = True).data

class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length = 12, max_length = 1000)

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

class SetupMFASerializer(serializers.Serializer):
    password = serializers.CharField()

class VerifyMFASerializer(serializers.Serializer):
    token = serializers.UUIDField()
    code = serializers.CharField()

class MeSerializer(serializers.Serializer):
    language = serializers.ChoiceField(UserPreferences.available_languages(), required = False)
    theme = serializers.ChoiceField(UserPreferences.available_themes(), required = False)
    has_sidebar_open = serializers.BooleanField(required = False)
    custom_instructions = serializers.CharField(allow_blank = True, max_length = 1000, required = False)
    nickname = serializers.CharField(allow_blank = True, max_length = 50, required = False)
    occupation = serializers.CharField(allow_blank = True, max_length = 50, required = False)
    about = serializers.CharField(allow_blank = True, max_length = 1000, required = False)

class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField()
    mfa_code = serializers.CharField(required = False, allow_blank = True)

class AuthenticateAsGuestSerializer(serializers.Serializer):
    guest_token = serializers.CharField(required = False)