import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.formats import date_format
from django.utils.translation import gettext_lazy as _
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

from .utils import readable_user_agent
from ..models import GuestIdentity, PasswordResetToken, PreAuthToken, User, derive_token_fingerprint, hash_user_agent
from ..serializers.user import (
    AuthenticateAsGuestSerializer, ConfirmPasswordResetSerializer, DeleteAccountSerializer, LoginSerializer,
    MeSerializer, RequestPasswordResetSerializer, SetupMFASerializer, SignupSerializer, UserSerializer, VerifyEmailSerializer, VerifyMFASerializer
)
from ..throttles import IPEmailRateThrottle, MFATokenRateThrottle, RefreshRateThrottle, RefreshTokenRateThrottle, SignupRateThrottle

class Signup(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request: Request):
        if User.objects.filter(
            has_verified_email = True,
            created_with_ip_address = request.ip_address,
            created_at__gt = timezone.now() - timedelta(days = 30)
        ).exists():
            return Response({"detail": "signup.ipAddressError"}, status.HTTP_400_BAD_REQUEST)

        qs = SignupSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        email = qs.validated_data["email"]
        password = qs.validated_data["password"]

        if User.objects.filter(email = email, has_verified_email = True).exists():
            return Response({"detail": "signup.emailError"}, status.HTTP_400_BAD_REQUEST)

        try:
            user: User = User.objects.get(email = email)
            user.set_password(password)
            user.save()
        except User.DoesNotExist:
            user = User.objects.create_user(email, password, ip_address = request.ip_address)

        user.email_verification_tokens.filter(used_at__isnull = True).update(expires_at = timezone.now())

        raw_token = secrets.token_urlsafe(32)
        user.email_verification_tokens.create(token_hash = make_password(raw_token), expires_at = timezone.now() + timedelta(hours = 24))

        subject = _("Signup.subject")
        verify_url = f"{settings.FRONTEND_URL}/verify-email?email={user.email}&token={raw_token}"

        device = readable_user_agent(request.user_agent_raw)
        request_time = date_format(timezone.localtime(timezone.now()), "DATETIME_FORMAT")

        message = _("Signup.message").format(verify_url = verify_url, time = request_time, ip = request.ip_address, device = device)

        html_message = render_to_string(
            "chat/email_verification.html",
            {"verify_url": verify_url, "year": timezone.now().year, "request_time": request_time, "ip_address": request.ip_address, "user_agent": device}
        )

        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], html_message = html_message)

        return Response(status = status.HTTP_201_CREATED)

class VerifyEmail(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        qs = VerifyEmailSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        email = qs.validated_data["email"]
        token = qs.validated_data["token"]

        try:
            user: User = User.objects.get(email = email)
        except User.DoesNotExist:
            return Response(status = status.HTTP_400_BAD_REQUEST)

        for t in user.email_verification_tokens.filter(used_at__isnull = True, expires_at__gt = timezone.now()):
            if check_password(token, t.token_hash):
                t.used_at = timezone.now()
                t.save(update_fields = ["used_at"])

                user.has_verified_email = True
                user.is_active = True
                user.save(update_fields = ["has_verified_email", "is_active"])

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

                response = Response(status = status.HTTP_204_NO_CONTENT)
                response.set_cookie("access_token", str(refresh.access_token), secure = True, httponly = True, samesite = "Strict")
                response.set_cookie("refresh_token", str(refresh), secure = True, httponly = True, samesite = "Strict")

                user.last_login = timezone.now()
                user.save(update_fields = ["last_login"])

                return response

        return Response(status = status.HTTP_400_BAD_REQUEST)

class Login(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        qs = LoginSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        email = qs.validated_data["email"]
        password = qs.validated_data["password"]

        if not User.objects.filter(email = email, has_verified_email = True, is_active = True, is_guest = False).exists():
            return Response({"detail": "login.error"}, status.HTTP_401_UNAUTHORIZED)

        user: User | None = authenticate(request, email = email, password = password)
        if user is None:
            return Response({"detail": "login.error"}, status.HTTP_401_UNAUTHORIZED)

        if user.mfa.is_enabled:
            token = secrets.token_urlsafe(32)
            user.pre_auth_tokens.create(
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

class RequestPasswordReset(APIView):
    authentication_classes = []
    throttle_classes = [IPEmailRateThrottle]

    def post(self, request: Request):
        qs = RequestPasswordResetSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        try:
            user: User = User.objects.get(email = qs.validated_data["email"], is_guest = False)
        except User.DoesNotExist:
            return Response(status = status.HTTP_200_OK)

        token = secrets.token_urlsafe(48)

        user.password_reset_tokens.create(
            token_fingerprint = derive_token_fingerprint(token),
            ip_address = request.ip_address,
            user_agent_hash = hash_user_agent(request.user_agent_raw or ""),
            expires_at = timezone.now() + timedelta(minutes = 15)
        )

        subject = _("RequestPasswordReset.subject")
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

        device = readable_user_agent(request.user_agent_raw)
        request_time = date_format(timezone.localtime(timezone.now()), "DATETIME_FORMAT")

        message = _("RequestPasswordReset.message").format(reset_url = reset_url, time = request_time, ip = request.ip_address, device = device)

        html_message = render_to_string(
            "chat/password_reset.html",
            {"reset_url": reset_url, "year": timezone.now().year, "request_time": request_time, "ip_address": request.ip_address, "user_agent": device}
        )

        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], html_message = html_message)

        return Response(status = status.HTTP_200_OK)

class ConfirmPasswordReset(APIView):
    authentication_classes = []

    def post(self, request):
        qs = ConfirmPasswordResetSerializer(data = request.data)
        qs.is_valid(raise_exception = True)

        try:
            token = PasswordResetToken.objects.select_related("user").get(
                token_fingerprint = derive_token_fingerprint(qs.validated_data["token"]),
                used_at__isnull = True,
                expires_at__gt = timezone.now()
            )
        except PasswordResetToken.DoesNotExist:
            return Response({"detail": "auth.resetPassword.invalid"}, status.HTTP_400_BAD_REQUEST)

        token.user.set_password(qs.validated_data["password"])
        token.user.save(update_fields = ["password"])

        token.used_at = timezone.now()
        token.save(update_fields = ["used_at"])

        OutstandingToken.objects.filter(user = token.user).delete()

        return Response(status = status.HTTP_204_NO_CONTENT)

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
                    current_ua_hash = hash_user_agent(request.user_agent_raw or "")
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