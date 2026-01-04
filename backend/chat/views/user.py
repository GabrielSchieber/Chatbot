import secrets
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from ..models import GuestIdentity, PreAuthToken, User, hash_user_agent
from ..serializers.user import (
    AuthenticateAsGuestSerializer, DeleteAccountSerializer, LoginSerializer,
    MeSerializer, SetupMFASerializer, SignupSerializer, UserSerializer, VerifyMFASerializer
)
from ..throttles import IPEmailRateThrottle, MFATokenRateThrottle, RefreshRateThrottle, RefreshTokenRateThrottle, SignupRateThrottle

class Signup(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request: Request):
        qs = SignupSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        email = qs.validated_data["email"]
        password = qs.validated_data["password"]

        if User.objects.filter(email = email).exists():
            return Response({"detail": "signup.emailError"}, status.HTTP_400_BAD_REQUEST)

        User.objects.create_user(email = email, password = password)

        return Response(status = status.HTTP_201_CREATED)

class Login(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        qs = LoginSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        email = qs.validated_data["email"]
        password = qs.validated_data["password"]

        user: User | None = authenticate(request, email = email, password = password, is_guest = False)
        if user is None:
            return Response({"detail": "login.error"}, status.HTTP_401_UNAUTHORIZED)

        if user.mfa.is_enabled:
            token = secrets.token_urlsafe(32)
            PreAuthToken.objects.create(
                user = user,
                token_hash = make_password(token),
                ip_address = request.ip_address,
                user_agent_hash = hash_user_agent(request.user_agent_raw or ""),
                expires_at = timezone.now() + timedelta(minutes = 3)
            )
            return Response({"token": token}, status.HTTP_200_OK)
        else:
            refresh = RefreshToken.for_user(user)

            refresh_jti = refresh.get("jti")
            user.sessions.create(
                ip_address = request.ip_address,
                user_agent = request.user_agent_raw,
                device = request.device,
                browser = request.browser,
                os = request.os,
                refresh_jti = refresh_jti
            )

            response = Response(status = status.HTTP_200_OK)
            response.set_cookie("access_token", str(refresh.access_token), secure = True, httponly = True, samesite = "Strict")
            response.set_cookie("refresh_token", str(refresh), secure = True, httponly = True, samesite = "Strict")

            user.last_login = timezone.now()
            user.save(update_fields = ["last_login"])

            return response

class Logout(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user

        refresh_token = request.COOKIES.get("refresh_token")
        if refresh_token is not None:
            try:
                refresh_jti = RefreshToken(refresh_token).get("jti")
                user.sessions.filter(logout_at__isnull = True, refresh_jti = refresh_jti).update(logout_at = timezone.now())
            except TokenError:
                pass

        response = Response(status = status.HTTP_200_OK)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class LogoutAllSessions(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user

        user.sessions.filter(logout_at__isnull = True).update(logout_at = timezone.now())
        tokens = OutstandingToken.objects.filter(user = user)
        for token in tokens:
            BlacklistedToken.objects.get_or_create(token = token)

        response = Response(status = status.HTTP_200_OK)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response

class Refresh(TokenRefreshView):
    authentication_classes = []
    throttle_classes = [RefreshRateThrottle, RefreshTokenRateThrottle]

    def post(self, request: Request):
        refresh_token = request.COOKIES.get("refresh_token")
        if refresh_token is None:
            return Response({"detail": "Refresh token is required to be present in cookies."}, status.HTTP_400_BAD_REQUEST)

        qs = TokenRefreshSerializer(data = {"refresh": refresh_token})
        try:
            qs.is_valid(raise_exception = True)
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status.HTTP_401_UNAUTHORIZED)

        access_token = qs.validated_data["access"]
        refresh_token = qs.validated_data["refresh"]

        response = Response(status = status.HTTP_200_OK)
        response.set_cookie("access_token", access_token, secure = True, httponly = True, samesite = "Strict")
        response.set_cookie("refresh_token", refresh_token, secure = True, httponly = True, samesite = "Strict")
        return response

class SetupMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user

        if user.is_guest:
            return Response({"detail": "Guest users cannot set up MFA."}, status.HTTP_400_BAD_REQUEST)

        if user.mfa.is_enabled:
            return Response({"detail": "MFA is already enabled for the current user. First disable MFA before setting it up again."}, status.HTTP_400_BAD_REQUEST)

        qs = SetupMFASerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        password = qs.validated_data["password"]

        if not user.check_password(password):
            return Response({"detail": "mfa.messages.errorInvalidPassword"}, status.HTTP_403_FORBIDDEN)

        secret, auth_url = user.mfa.setup()
        return Response({"auth_url": auth_url, "secret": secret}, status.HTTP_200_OK)

class EnableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user

        if user.is_guest:
            return Response({"detail": "Guest users cannot enable MFA."}, status.HTTP_400_BAD_REQUEST)

        if user.mfa.is_enabled:
            return Response({"detail": "MFA is already enabled for the current user."}, status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code")

        if not user.mfa.verify(code):
            return Response({"detail": "mfa.messages.errorInvalidCode"}, status.HTTP_403_FORBIDDEN)

        backup_codes = user.mfa.enable()
        return Response({"backup_codes": backup_codes}, status.HTTP_200_OK)

class DisableMFA(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        user: User = request.user

        if user.is_guest:
            return Response({"detail": "Guest users cannot have MFA."}, status.HTTP_400_BAD_REQUEST)

        if not user.mfa.is_enabled:
            return Response({"detail": "MFA is already disabled for the current user."}, status.HTTP_400_BAD_REQUEST)

        code = request.data.get("code")

        if not user.mfa.verify(code):
            return Response({"detail": "mfa.messages.errorInvalidCode"}, status.HTTP_403_FORBIDDEN)

        user.mfa.disable()
        return Response(status = status.HTTP_200_OK)

class VerifyMFA(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle, MFATokenRateThrottle]

    def post(self, request: Request):
        qs = VerifyMFASerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        token = qs.validated_data["token"]
        code = qs.validated_data["code"]

        for t in PreAuthToken.objects.filter(used_at__isnull = True, expires_at__gt = timezone.now()):
            if check_password(token, t.token_hash):
                pre_auth_token = t
                break
        else:
            return Response({"detail": "mfa.messages.errorInvalidOrExpiredCode"}, status.HTTP_401_UNAUTHORIZED)

        if any([
            not check_password(token, pre_auth_token.token_hash),
            pre_auth_token.ip_address != request.ip_address,
            pre_auth_token.user_agent_hash != hash_user_agent(request.user_agent_raw or "")
        ]):
            return Response({"detail": "mfa.messages.errorInvalidOrExpiredCode"}, status.HTTP_401_UNAUTHORIZED)

        user = pre_auth_token.user
        if not user.mfa.verify(code):
            return Response({"detail": "mfa.messages.errorInvalidCode"}, status.HTTP_401_UNAUTHORIZED)

        pre_auth_token.used_at = timezone.now()
        pre_auth_token.save(update_fields = ["used_at"])

        refresh = RefreshToken.for_user(user)

        refresh_jti = refresh.get("jti")
        user.sessions.create(
            ip_address = request.ip_address,
            user_agent = request.user_agent_raw,
            device = request.device,
            browser = request.browser,
            os = request.os,
            refresh_jti = refresh_jti
        )

        response = Response(status = status.HTTP_200_OK)
        response.set_cookie("access_token", str(refresh.access_token), secure = True, httponly = True, samesite = "Strict")
        response.set_cookie("refresh_token", str(refresh), secure = True, httponly = True, samesite = "Strict")

        user.last_login = timezone.now()
        user.save(update_fields = ["last_login"])

        return response

class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        return Response(UserSerializer(request.user, many = False).data, status.HTTP_200_OK)

    def patch(self, request: Request):
        user: User = request.user

        qs = MeSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        for key in ["language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about"]:
            value = qs.validated_data.get(key)
            if value is not None:
                setattr(user.preferences, key, value)

        user.preferences.save()
        return Response(status = status.HTTP_200_OK)

class DeleteAccount(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request):
        user: User = request.user

        if not user.is_guest:
            qs = DeleteAccountSerializer(data = request.data)
            qs.is_valid(raise_exception = True)

            password = qs.validated_data["password"]
            mfa_code = qs.validated_data.get("mfa_code")

            if not user.check_password(password):
                return Response({"detail": "mfa.messages.errorInvalidPassword"}, status.HTTP_403_FORBIDDEN)

            if user.mfa.is_enabled:
                if mfa_code is None:
                    return Response({"detail": "MFA code is required."}, status.HTTP_400_BAD_REQUEST)
                if not user.mfa.verify(mfa_code):
                    return Response({"detail": "mfa.messages.errorInvalidCode"}, status.HTTP_403_FORBIDDEN)

        user.delete()
        response = Response(status = status.HTTP_204_NO_CONTENT)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        response.delete_cookie("guest_token")
        return response

class AuthenticateAsGuest(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        qs = AuthenticateAsGuestSerializer(data = request.COOKIES)
        try:
            qs.is_valid(raise_exception = True)
            guest_token = qs.validated_data.get("guest_token")
        except ValidationError:
            guest_token = None

        user: User | None = None
        if guest_token:
            identity = GuestIdentity.objects.select_related("user").filter(expires_at__gt = timezone.now()).first()

            if identity:
                if not check_password(guest_token, identity.user.password):
                    identity = None
                elif identity.user_agent_hash:
                    current_ua_hash = GuestIdentity.hash_user_agent(request.user_agent_raw or "")
                    if current_ua_hash != identity.user_agent_hash:
                        identity = None

            if identity:
                user = identity.user

        created = False

        if user is None:
            identity, guest_token = GuestIdentity.create(request.ip_address, request.user_agent_raw or "")
            user = identity.user
            created = True

        refresh = RefreshToken.for_user(user)

        user.sessions.create(
            ip_address = request.ip_address,
            user_agent = request.user_agent_raw,
            device = request.device,
            browser = request.browser,
            os = request.os,
            refresh_jti = refresh.get("jti")
        )

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        response = Response(status = status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        response.set_cookie("access_token", str(refresh.access_token), secure = True, httponly = True, samesite = "Strict")
        response.set_cookie("refresh_token", str(refresh), secure = True, httponly = True, samesite = "Strict")
        response.set_cookie("guest_token", guest_token, 60 * 60 * 24 * 30, secure = True, httponly = True, samesite = "Strict")
        return response