import uuid
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase as DjangoTestCase
from django.test.client import encode_multipart, BOUNDARY
from django.utils import timezone
from freezegun import freeze_time
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .utils import create_user
from ..models import Chat, Message, MessageFile, User, UserSession
from ..totp_utils import generate_code
from ..urls import urlpatterns

class TestCase(DjangoTestCase):
    def login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        return self.client.post("/api/login/", {"email": email, "password": password})

    def logout_user(self):
        return self.client.post("/api/logout/")

    def create_and_login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        user = create_user(email, password)
        response = self.login_user(email, password)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 2)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        return user

class Signup(TestCase):
    def test(self):
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.all().count(), 1)
        user = User.objects.first()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_with_existing_email(self):
        create_user()
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.all().count(), 1)

    def test_with_invalid_email(self):
        def test(email: str):
            response = self.client.post("/api/signup/", {"email": email, "password": "testpassword"})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"email": ["Enter a valid email address."]})
            self.assertEqual(User.objects.all().count(), 0)

        test("test")
        test("example.com")
        test("test@example")
        test("@example")
        test("test@")
        test("test@.com")
        test("@.com")

    def test_with_invalid_password(self):
        def test(password: str, excected_json):
            response = self.client.post("/api/signup/", {"email": "test@example.com", "password": password})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), excected_json)
            self.assertEqual(User.objects.all().count(), 0)

        test("", {"password": ["This field may not be blank."]})
        test("test", {"password": ["Ensure this field has at least 12 characters."]})
        test("onepassword", {"password": ["Ensure this field has at least 12 characters."]})
        test("".join(["password123" for _ in range(91)]), {"password": ["Ensure this field has no more than 1000 characters."]})

class Login(TestCase):
    def test(self):
        self.create_and_login_user()

    def test_with_invalid_credentials(self):
        def test(email: str, password: str):
            response = self.login_user(email, password)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"detail": "login.error"})

        create_user()
        test("someemail@example.com", "somepassword")
        test("test@example.com", "somepassword")
        test("someemail@example.com", "testpassword")

    def test_with_mfa_enabled(self):
        user = create_user()
        user.mfa.setup()
        user.mfa.enable()

        response = self.login_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 0)

        token = response.json()["token"]
        response = self.client.post("/api/verify-mfa/", {"token": token, "code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 2)
            self.assertIn("access_token", cookies)
            self.assertIn("refresh_token", cookies)

            for _, cookie in cookies.items():
                self.assertTrue(cookie["httponly"])
                self.assertEqual(cookie["samesite"], "Lax")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

    def test_creates_session(self):
        user = create_user()
        self.assertEqual(user.sessions.count(), 0)
        self.login_user()
        self.assertEqual(user.sessions.count(), 1)
        session = user.sessions.first()
        self.assertIsNotNone(session)
        self.assertIsNotNone(session.login_at)
        self.assertIsNone(session.logout_at)
        self.assertEqual(session.ip_address, "127.0.0.1")
        self.assertEqual(session.user_agent, "")
        self.assertEqual(session.device, "Device(family='Other', brand=None, model=None)")
        self.assertEqual(session.browser, "Other")
        self.assertEqual(session.os, "Other")
        self.assertEqual(len(session.refresh_jti), 32)
        assert all(c in "0123456789abcdefABCDEF" for c in session.refresh_jti)

class VerifyMFA(TestCase):
    def test(self):
        def is_valid_uuid4(value: str):
            try:
                uuid.UUID(value, version = 4)
            except ValueError:
                return False
            return True

        user = create_user()
        user.mfa.setup()
        user.mfa.enable()

        response = self.login_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 0)

        token = response.json()["token"]
        self.assertEqual(type(token), str)
        self.assertTrue(is_valid_uuid4(token))

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/verify-mfa/", {"token": token, "code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 2)
            self.assertIn("access_token", cookies)
            self.assertIn("refresh_token", cookies)

            for _, cookie in cookies.items():
                self.assertTrue(cookie["httponly"])
                self.assertEqual(cookie["samesite"], "Lax")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

    def test_invalid_or_expired_code(self):
        response = self.client.post("/api/verify-mfa/", {"token": str(uuid.uuid4()), "code": "123456"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidOrExpiredCode"})

        time_to_freeze = timezone.datetime(2025, 1, 1, 12)
        with freeze_time(time_to_freeze):
            user = create_user()
            user.mfa.setup()
            user.mfa.enable()

            response = self.login_user()
            self.assertEqual(len(response.cookies), 0)
            token = response.json()["token"]

            response = self.client.post("/api/verify-mfa/", {"token": token, "code": "123456"})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidCode"})

        with freeze_time(time_to_freeze + timedelta(minutes = 5)):
            response = self.client.post("/api/verify-mfa/", {"token": token, "code": "123456"})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidCode"})

        with freeze_time(time_to_freeze + timedelta(minutes = 5, seconds = 1)):
            response = self.client.post("/api/verify-mfa/", {"token": token, "code": "123456"})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidOrExpiredCode"})

    def test_backup_codes(self):
        def assert_empty_cookies():
            if len(response.cookies.items()) != 0:
                self.assertEqual(len(response.cookies.items()), 2)
                self.assertEqual(response.cookies["access_token"].value, "")
                self.assertEqual(response.cookies["refresh_token"].value, "")

            self.assertEqual(len(self.client.cookies.items()), 2)
            self.assertEqual(self.client.cookies["access_token"].value, "")
            self.assertEqual(self.client.cookies["refresh_token"].value, "")

        user = create_user()
        user.mfa.setup()
        backup_codes = user.mfa.enable()

        for backup_code in backup_codes:
            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

            response = self.login_user()
            self.assertEqual(response.status_code, 200)
            token = response.json()["token"]

            response = self.client.post("/api/verify-mfa/", {"token": token, "code": backup_code})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.cookies), 2)
            self.assertEqual(len(self.client.cookies), 2)

            access_token = dict(response.cookies["access_token"].items())
            self.assertTrue(access_token["httponly"])
            self.assertEqual(access_token["samesite"], "Lax")

            refresh_token = dict(response.cookies["refresh_token"].items())
            self.assertTrue(refresh_token["httponly"])
            self.assertEqual(refresh_token["samesite"], "Lax")

            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 200)

            response = self.client.post("/api/logout/")
            self.assertEqual(response.status_code, 200)
            assert_empty_cookies()

        for backup_code in backup_codes:
            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

            response = self.login_user()
            self.assertEqual(response.status_code, 200)
            token = response.json()["token"]

            response = self.client.post("/api/verify-mfa/", {"token": token, "code": backup_code})
            self.assertEqual(response.status_code, 401)
            assert_empty_cookies()

            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

    def test_creates_session_if_token_and_code_are_valid(self):
        user = create_user()
        user.mfa.setup()
        user.mfa.enable()

        self.assertEqual(user.sessions.count(), 0)

        response = self.login_user()
        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]

        self.assertEqual(user.sessions.count(), 0)

        response = self.client.post("/api/verify-mfa/", {"token": token, "code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)

        self.assertEqual(user.sessions.count(), 1)

        session = user.sessions.first()
        self.assertIsNotNone(session)
        self.assertIsNotNone(session.login_at)
        self.assertIsNone(session.logout_at)
        self.assertEqual(session.ip_address, "127.0.0.1")
        self.assertEqual(session.user_agent, "")
        self.assertEqual(session.device, "Device(family='Other', brand=None, model=None)")
        self.assertEqual(session.browser, "Other")
        self.assertEqual(session.os, "Other")
        self.assertEqual(len(session.refresh_jti), 32)
        assert all(c in "0123456789abcdefABCDEF" for c in session.refresh_jti)

    def test_does_not_create_session_if_token_is_invalid(self):
        user = create_user()
        user.mfa.setup()
        user.mfa.enable()

        self.assertEqual(user.sessions.count(), 0)

        response = self.login_user()
        self.assertEqual(response.status_code, 200)

        self.assertEqual(user.sessions.count(), 0)

        response = self.client.post("/api/verify-mfa/", {"token": "invalid", "code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 400)

        self.assertEqual(user.sessions.count(), 0)

    def test_does_not_create_session_if_code_is_invalid(self):
        user = create_user()
        user.mfa.setup()
        user.mfa.enable()

        self.assertEqual(user.sessions.count(), 0)

        response = self.login_user()
        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]

        self.assertEqual(user.sessions.count(), 0)

        response = self.client.post("/api/verify-mfa/", {"token": token, "code": "invalid"})
        self.assertEqual(response.status_code, 401)

        self.assertEqual(user.sessions.count(), 0)

class Logout(TestCase):
    def test(self):
        self.create_and_login_user()
        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertNotEqual(self.client.cookies["access_token"].value, "")
        self.assertNotEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 1)
        self.assertIsNone(UserSession.objects.first().logout_at)

        response = self.logout_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 2)
        self.assertEqual(response.cookies["access_token"].value, "")
        self.assertEqual(response.cookies["refresh_token"].value, "")

        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertEqual(self.client.cookies["access_token"].value, "")
        self.assertEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 1)
        self.assertIsNotNone(UserSession.objects.first().logout_at)

    def test_tampered_refresh_token(self):
        self.create_and_login_user()
        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertNotEqual(self.client.cookies["access_token"].value, "")
        self.assertNotEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 1)
        self.assertIsNone(UserSession.objects.first().logout_at)

        original = self.client.cookies["refresh_token"].value
        tampered = original[:-1] + ("A" if original[-1] != "A" else "B")

        self.client.cookies["refresh_token"] = tampered

        response = self.logout_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 2)
        self.assertEqual(response.cookies["access_token"].value, "")
        self.assertEqual(response.cookies["refresh_token"].value, "")

        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertEqual(self.client.cookies["access_token"].value, "")
        self.assertEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 1)
        self.assertIsNone(UserSession.objects.first().logout_at)

class LogoutAllSessions(TestCase):
    def test(self):
        self.create_and_login_user()
        self.login_user()

        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertNotEqual(self.client.cookies["access_token"].value, "")
        self.assertNotEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 2)
        for s in UserSession.objects.all():
            self.assertIsNone(s.logout_at)

        response = self.client.post("/api/logout-all-sessions/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 2)
        self.assertEqual(response.cookies["access_token"].value, "")
        self.assertEqual(response.cookies["refresh_token"].value, "")

        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertEqual(self.client.cookies["access_token"].value, "")
        self.assertEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 2)
        for s in UserSession.objects.all():
            self.assertIsNotNone(s.logout_at)

class Refresh(TestCase):
    def test(self):
        refresh = RefreshToken.for_user(create_user())
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

        self.assertNotEqual(response.cookies["refresh_token"].value, str(refresh))

    def test_without_cookie(self):
        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Refresh token is required to be present in cookies."})

    def test_with_invalid_cookie(self):
        self.client.cookies["refresh_token"] = "not-a-real-token"

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Invalid refresh token."})

    def test_with_blacklisted_cookie(self):
        refresh = RefreshToken.for_user(create_user())
        refresh.blacklist()
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Invalid refresh token."})

    def test_with_expired_cookie(self):
        refresh = RefreshToken.for_user(create_user())
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 200)

        exp_timestamp = refresh["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp, dt_timezone.utc)

        with freeze_time(exp_datetime + timedelta(seconds = 1)):
            response = self.client.post("/api/refresh/")
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"detail": "Invalid refresh token."})

    def test_with_tampered_cookie(self):
        refresh = RefreshToken.for_user(create_user())

        original = str(refresh)
        tampered = original[:-1] + ("A" if original[-1] != "A" else "B")

        self.client.cookies["refresh_token"] = tampered

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(len(response.cookies.items()), 0)

        self.assertNotIn("access_token", self.client.cookies)
        self.assertIn("refresh_token", self.client.cookies)
        self.assertEqual(len(self.client.cookies.items()), 1)

    def test_with_login(self):
        create_user()
        response = self.login_user()
        self.client.cookies = response.cookies

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)

    def test_with_token_signed_with_wrong_key(self):
        real_refresh = RefreshToken.for_user(create_user())
        wrong_backend = TokenBackend("HS256", "not-the-real-secret-key")
        wrong_token = wrong_backend.encode(real_refresh.payload)
        self.client.cookies["refresh_token"] = wrong_token

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access_token", self.client.cookies)
        self.assertEqual(self.client.cookies["refresh_token"].value, wrong_token)
        self.assertEqual(len(self.client.cookies.items()), 1)

    def test_with_used_cookie(self):
        self.create_and_login_user()

        old_refresh = self.client.cookies["refresh_token"].value

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 200)

        new_refresh = self.client.cookies["refresh_token"].value
        self.assertNotEqual(old_refresh, new_refresh)

        self.client.cookies["refresh_token"] = old_refresh

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)

    def test_cookie_expiry_header(self):
        self.client.cookies["refresh_token"] = str(RefreshToken.for_user(create_user()))
        response = self.client.post("/api/refresh/")
        self.assertIsNotNone(response.cookies["access_token"]["expires"])

    def test_flow_issues_new_access_cookie(self):
        time_to_freeze = timezone.datetime(2025, 1, 1, 12)
        with freeze_time(time_to_freeze):
            self.create_and_login_user()
            access_cookie = self.client.cookies["access_token"]

        access_lifetime = jwt_settings.ACCESS_TOKEN_LIFETIME
        expire_at = time_to_freeze + access_lifetime + timedelta(seconds = 1)

        with freeze_time(expire_at):
            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

            response = self.client.post("/api/refresh/")
            self.assertEqual(response.status_code, 200)
            self.assertIn("access_token", self.client.cookies)

            new_access_cookie = self.client.cookies["access_token"].value
            self.assertNotEqual(new_access_cookie, access_cookie.value)

            response = self.client.post("/api/refresh/")
            self.assertEqual(response.status_code, 200)

class Me(TestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

        expected_json = {
            "email": user.email,
            "preferences": {
                "language": "",
                "theme": "System",
                "has_sidebar_open": True,
                "custom_instructions": "",
                "nickname": "",
                "occupation": "",
                "about": ""
            },
            "mfa": {
                "is_enabled": False
            },
            "sessions": [{
                "login_at": str(user.sessions.first().login_at),
                "logout_at": None,
                "ip_address": "127.0.0.1",
                "browser": "Other",
                "os": "Other"
            }]
        }

        self.assertEqual(response.json(), expected_json)

    def test_patch(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

        expected_json = {
            "email": user.email,
            "preferences": {
                "language": "",
                "theme": "System",
                "has_sidebar_open": True,
                "custom_instructions": "",
                "nickname": "",
                "occupation": "",
                "about": ""
            },
            "mfa": {
                "is_enabled": False
            },
            "sessions": [{
                "login_at": str(user.sessions.first().login_at),
                "logout_at": None,
                "ip_address": "127.0.0.1",
                "browser": "Other",
                "os": "Other"
            }]
        }

        self.assertEqual(response.json(), expected_json)

        modifications = {
            "language": "Português",
            "about": "I'm a programmer.",
            "custom_instructions": "Always talk like a pirate.",
            "nickname": "Lizard",
            "theme": "Light",
            "occupation": "Software Engineer",
            "has_sidebar_open": False
        }

        for key, value in modifications.items():
            response = self.client.patch("/api/me/", {key: value}, "application/json")
            self.assertEqual(response.status_code, 200)

            expected_json["preferences"][key] = value

            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected_json)

    def test_with_expired_cookie(self):
        refresh = RefreshToken.for_user(create_user())
        self.client.cookies["access_token"] = str(refresh.access_token)

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

        exp_timestamp = refresh.access_token["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp, dt_timezone.utc)

        with freeze_time(exp_datetime + timedelta(seconds = 1)):
            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

    def test_uses_access_cookie_via_middleware(self):
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        self.create_and_login_user()
        self.assertIn("access_token", self.client.cookies)

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "test@example.com")

    def test_clear_preferences(self):
        user = self.create_and_login_user()
        user.preferences.custom_instructions = "Always talk like a pirate."
        user.preferences.save()
        self.assertEqual(user.preferences.custom_instructions, "Always talk like a pirate.")

        response = self.client.patch("/api/me/", {"custom_instructions": ""}, "application/json")
        self.assertEqual(response.status_code, 200)

        user.preferences.refresh_from_db()
        self.assertEqual(user.preferences.custom_instructions, "")

        user.preferences.occupation = "Software Engineer"
        user.preferences.about = "I'm a full-stack web developer."
        user.preferences.save()
        self.assertEqual(user.preferences.occupation, "Software Engineer")
        self.assertEqual(user.preferences.about, "I'm a full-stack web developer.")

        response = self.client.patch("/api/me/", {"occupation": "", "about": ""}, "application/json")
        self.assertEqual(response.status_code, 200)

        user.preferences.refresh_from_db()
        self.assertEqual(user.preferences.occupation, "")
        self.assertEqual(user.preferences.about, "")

class SetupMFA(TestCase):
    def test(self):
        user = self.create_and_login_user()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

        response = self.client.post("/api/setup-mfa/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        auth_url = response.json()["auth_url"]
        secret = response.json()["secret"]

        self.assertEqual(auth_url, f"otpauth://totp/Chatbot:test%40example.com?secret={secret}&issuer=Chatbot")
        self.assertNotEqual(secret, user.mfa.secret)

        user = User.objects.get(email = "test@example.com")
        self.assertNotEqual(user.mfa.secret, b"")
        self.assertEqual(len(user.mfa.secret), 140)
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_requires_to_be_disabled(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()

        response = self.client.post("/api/setup-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "MFA is already enabled for the current user. First disable MFA before setting it up again."})

    def test_overwrites_secret(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        previous_encrypted_secret = user.mfa.secret

        response = self.client.post("/api/setup-mfa/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        auth_url = response.json()["auth_url"]
        secret = response.json()["secret"]

        self.assertEqual(auth_url, f"otpauth://totp/Chatbot:test%40example.com?secret={secret}&issuer=Chatbot")

        user.refresh_from_db()
        self.assertNotEqual(secret, user.mfa.secret)
        self.assertNotEqual(previous_encrypted_secret, user.mfa.secret)

class EnableMFA(TestCase):
    def test(self):
        user = self.create_and_login_user()

        user.mfa.setup()
        response = self.client.post("/api/enable-mfa/", {"code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)

        backup_codes = response.json()["backup_codes"]
        self.assertEqual(type(backup_codes), list)
        self.assertEqual(len(backup_codes), 10)
        for backup_code in backup_codes:
            self.assertEqual(type(backup_code), str)
            self.assertEqual(len(backup_code), 12)

        user = User.objects.get(email = "test@example.com")
        self.assertEqual(len(user.mfa.backup_codes), 10)
        for hashed_backup_code in user.mfa.backup_codes:
            self.assertEqual(len(hashed_backup_code), 89)
        self.assertTrue(user.mfa.is_enabled)

        for backup_code, hashed_backup_code in zip(backup_codes, user.mfa.backup_codes):
            self.assertNotEqual(backup_code, hashed_backup_code)

    def test_requires_to_be_disabled(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()

        response = self.client.post("/api/enable-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "MFA is already enabled for the current user."})

    def test_requires_valid_code(self):
        user = self.create_and_login_user()
        user.mfa.setup()

        for code in ["", "1", "-1", "12345", "-12345", "1234567", "-1234567", "a", "abcdef"]:
            response = self.client.post("/api/enable-mfa/", {"code": code})
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidCode"})

class DisableMFA(TestCase):
    def test(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()
        self.assertNotEqual(user.mfa.secret, b"")
        self.assertNotEqual(user.mfa.backup_codes, [])
        self.assertTrue(user.mfa.is_enabled)

        response = self.client.post("/api/disable-mfa/", {"code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        user = User.objects.get(email = "test@example.com")
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_requires_to_be_enabled(self):
        self.create_and_login_user()
        response = self.client.post("/api/disable-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "MFA is already disabled for the current user."})

    def test_requires_valid_code(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()

        for code in ["", "1", "-1", "12345", "-12345", "1234567", "-1234567", "a", "abcdef"]:
            response = self.client.post("/api/disable-mfa/", {"code": code})
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidCode"})

class DeleteAccount(TestCase):
    def test(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-account/", {"password": "testpassword"}, "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(User.objects.count(), 0)

        user1 = self.create_and_login_user("someone@example.com")

        self.create_and_login_user()
        response = self.client.delete("/api/delete-account/", {"password": "testpassword"}, "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user1)

        user2 = self.create_and_login_user()
        user2.mfa.setup()
        user2.mfa.enable()
        response = self.client.delete("/api/delete-account/", {"password": "testpassword", "mfa_code": generate_code(user2.mfa.secret)}, "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user1)

    def test_requires_password(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-account/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"password": ["This field is required."]})

    def test_requires_password_and_mfa_code_if_mfa_is_enabled(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()

        response = self.client.delete("/api/delete-account/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"password": ["This field is required."]})

        response = self.client.delete("/api/delete-account/", {"password": "testpassword"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "MFA code is required."})

    def test_invalid_password(self):
        user = self.create_and_login_user()
        response = self.client.delete("/api/delete-account/", {"password": "invalidpassword"}, "application/json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidPassword"})
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user)

    def test_invalid_mfa_code(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()
        response = self.client.delete("/api/delete-account/", {"password": "testpassword", "mfa_code": "12345"}, "application/json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidCode"})
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user)

class GetChat(TestCase):
    def test(self):
        user1 = self.create_and_login_user()
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

        chat1 = Chat.objects.create(user = user1, title = "Greetings")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat1.uuid), "title": "Greetings", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat2 = Chat.objects.create(user = user1, title = "Math Question")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat2.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat2.uuid),"title": "Math Question", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat3 = Chat.objects.create(user = user1, title = "Weather Inquiry", is_archived = True)
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat3.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat3.uuid),"title": "Weather Inquiry", "pending_message_id": None, "is_archived": True, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat4 = Chat.objects.create(user = user1, title = "Joke Request")
        chat4.pending_message = Message.objects.create(chat = chat4, text = "Tell me a joke.", is_from_user = True)
        chat4.save()
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat4.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat4.uuid),"title": "Joke Request", "pending_message_id": 1, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat1.uuid), "title": "Greetings", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 3}
        self.assertEqual(response.json(), expected_json)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

        chat5 = Chat.objects.create(user = user2, title = "Travel Advice")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat5.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat5.uuid), "title": "Travel Advice", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class GetChats(TestCase):
    def test(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat.uuid), "title": chat.title, "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": i}
            for i, chat in enumerate(user.chats.order_by("-created_at"))
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

    def test_user_without_chats(self):
        self.create_and_login_user()
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"chats": [], "has_more": False})

    def test_offset(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/get-chats/?offset={5}")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat.uuid), "title": chat.title, "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": i + 5}
            for i, chat in enumerate(user.chats.order_by("-created_at")[5:])
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

    def test_limit(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/get-chats/?limit={5}")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat.uuid), "title": chat.title, "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": i}
            for i, chat in enumerate(user.chats.order_by("-created_at")[:5])
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": True})

    def test_pending(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(5)])

        chat1 = user.chats.order_by("created_at")[0]
        chat1.pending_message = chat1.messages.create(text = "Hello!", is_from_user = False)
        chat1.save()
        chat3 = user.chats.order_by("created_at")[2]
        chat3.pending_message = chat1.messages.create(text = "Hi!", is_from_user = False)
        chat3.save()

        response = self.client.get(f"/api/get-chats/?pending=true")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat3.uuid), "title": chat3.title, "pending_message_id": 2, "is_archived": False, "is_temporary": False, "index": 2},
            {"uuid": str(chat1.uuid), "title": chat1.title, "pending_message_id": 1, "is_archived": False, "is_temporary": False, "index": 4}
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

    def test_archived(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(5)])

        chat1 = user.chats.order_by("created_at")[0]
        chat1.is_archived = True
        chat1.save()
        chat3 = user.chats.order_by("created_at")[2]
        chat3.is_archived = True
        chat3.save()

        response = self.client.get(f"/api/get-chats/?archived=true")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat3.uuid), "title": chat3.title, "pending_message_id": None, "is_archived": True, "is_temporary": False, "index": 2},
            {"uuid": str(chat1.uuid), "title": chat1.title, "pending_message_id": None, "is_archived": True, "is_temporary": False, "index": 4}
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

class SearchChats(TestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        chat = Chat.objects.create(user = user, title = "A question about math")

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        response = self.client.get("/api/search-chats/?search=A question about math")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": [],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        Message.objects.create(chat = chat, text = "What is math?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Math is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": ["What is math?"],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=math")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": ["What is math?", "Math is..."],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        chat = Chat.objects.create(user = user, title = "Geometry question")

        response = self.client.get("/api/search-chats/?search=Question about geometry")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        response = self.client.get("/api/search-chats/?search=Geometry question")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": [],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        Message.objects.create(chat = chat, text = "What is geometry?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Geometry is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": ["What is geometry?"],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=geometry")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": ["What is geometry?", "Geometry is..."],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_user_without_chats(self):
        self.create_and_login_user()
        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

    def test_user_with_chats(self):
        user = self.create_and_login_user()
        self.create_example_chats_for_user(user)

        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)

        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [m.text for m in chat.messages.all()],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in user.chats.order_by("-created_at")
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_search(self):
        user = self.create_and_login_user()
        self.create_example_chats_for_user(user)

        response = self.client.get("/api/search-chats/?search=Hello")
        self.assertEqual(response.status_code, 200)

        expected_chat = user.chats.get(title = "Greetings")
        expected_entries = [
            {
                "uuid": str(expected_chat.uuid),
                "title": expected_chat.title,
                "matches": [m.text for m in expected_chat.messages.all()],
                "is_archived": False,
                "last_modified_at": expected_chat.last_modified_at().isoformat()
            }
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=are")
        self.assertEqual(response.status_code, 200)

        expected_chats = [user.chats.get(title = "Travel Advice"), user.chats.get(title = "Greetings")]
        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [m.text for m in chat.messages.filter(text__icontains = "are")],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in expected_chats
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_offset(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/search-chats/?offset={5}")
        self.assertEqual(response.status_code, 200)

        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in user.chats.order_by("-created_at")[5:]
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_limit(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/search-chats/?limit={5}")
        self.assertEqual(response.status_code, 200)

        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in user.chats.order_by("-created_at")[:5]
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": True})

    def create_example_chats_for_user(self, user: User):
        chat = user.chats.create(title = "Greetings")
        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How are you?", is_from_user = False)

        chat = user.chats.create(title = "Weather Inquiry")
        chat.messages.create(text = "What's the weather like today?", is_from_user = True)
        chat.messages.create(text = "It's sunny with a high of 28°C.", is_from_user = False)

        chat = user.chats.create(title = "Travel Advice")
        chat.messages.create(text = "What's the best time to visit Japan?", is_from_user = True)
        chat.messages.create(text = "Spring and autumn are ideal for pleasant weather and beautiful scenery.", is_from_user = False)
        chat.messages.create(text = "Thanks! I'll plan for April.", is_from_user = True)
        chat.messages.create(text = "Great choice! Cherry blossoms are stunning that time of year.", is_from_user = False)

class RenameChat(TestCase):
    def test(self):
        def rename(chat_uuid: str, new_title: str):
            response =  self.client.patch("/api/rename-chat/", {"chat_uuid": chat_uuid, "new_title": new_title}, "application/json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = Chat.objects.create(user = user1, title = "Test title")

        rename(chat1.uuid, "Greetings")
        self.assertEqual(Chat.objects.first().title, "Greetings")

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat2 = Chat.objects.create(user = user2, title = "Some chat")

        rename(chat2.uuid, "Travel Advice")

        chats = Chat.objects.order_by("created_at")
        self.assertEqual(chats.last().title, "Travel Advice")
        self.assertEqual(chats.first().title, "Greetings")

        self.assertEqual(chats.first().user, user1)
        self.assertEqual(chats.last().user, user2)

    def test_requires_chat_uuid_and_new_title(self):
        self.create_and_login_user()
        response = self.client.patch("/api/rename-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "new_title": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": "invalid", "new_title": "Some Chat"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": str(uuid.uuid4()), "new_title": "Some Chat"}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class ArchiveChat(TestCase):
    def test(self):
        def archive(chat: Chat):
            response = self.client.patch("/api/archive-chat/", {"chat_uuid": str(chat.uuid)}, "application/json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = user1.chats.create(title = "Greetings")
        chat2 = user1.chats.create(title = "Math Help")
        self.assertFalse(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

        archive(chat1)
        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertTrue(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = user2.chats.create(title = "Travel Advice")
        chat4 = user2.chats.create(title = "Recipe Suggestion")

        archive(chat3)
        chat3.refresh_from_db()
        chat4.refresh_from_db()
        self.assertTrue(chat3.is_archived)
        self.assertFalse(chat4.is_archived)

        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertTrue(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/archive-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/archive-chat/", {"chat_uuid": "invalid"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.patch("/api/archive-chat/", {"chat_uuid": str(uuid.uuid4())}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class UnarchiveChat(TestCase):
    def test(self):
        def unarchive(chat: Chat):
            response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": str(chat.uuid)}, "application/json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = user1.chats.create(title = "Greetings", is_archived = True)
        chat2 = user1.chats.create(title = "Math Help", is_archived = True)
        self.assertTrue(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

        unarchive(chat1)
        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertFalse(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = user2.chats.create(title = "Travel Advice", is_archived = True)
        chat4 = user2.chats.create(title = "Recipe Suggestion", is_archived = True)

        unarchive(chat3)
        chat3.refresh_from_db()
        chat4.refresh_from_db()
        self.assertFalse(chat3.is_archived)
        self.assertTrue(chat4.is_archived)

        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertFalse(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": "invalid"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": str(uuid.uuid4())}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class DeleteChat(TestCase):
    def test(self):
        def delete(chat: Chat):
            response = self.client.delete("/api/delete-chat/", {"chat_uuid": str(chat.uuid)}, "application/json")
            self.assertEqual(response.status_code, 204)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = user1.chats.create(title = "Greetings")
        chat2 = user1.chats.create(title = "Math Help")

        delete(chat1)
        self.assertEqual(list(Chat.objects.all()), [chat2])

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = user2.chats.create(title = "Travel Advice")
        chat4 = user2.chats.create(title = "Recipe Suggestion")

        delete(chat3)
        self.assertEqual(list(Chat.objects.all()), [chat2, chat4])

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": "invalid"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": str(uuid.uuid4())}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class ArchiveChats(TestCase):
    def test(self):
        user1 = self.create_and_login_user()
        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 200)

        Chat.objects.create(user = user1, title = "Greetings")

        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 200)

        self.assertTrue(Chat.objects.get(user = user1, title = "Greetings").is_archived)

        Chat.objects.create(user = user1, title = "Travel Advice")
        Chat.objects.create(user = user1, title = "Math Help")

        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 200)

        self.assertTrue(Chat.objects.get(user = user1, title = "Travel Advice").is_archived)
        self.assertTrue(Chat.objects.get(user = user1, title = "Math Help").is_archived)

        user1.chats.update(is_archived = False)
        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertFalse(c.is_archived)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")

        Chat.objects.create(user = user2, title = "Math Question")
        Chat.objects.create(user = user2, title = "Recipe Suggestion")

        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Chat.objects.get(user = user2, title = "Math Question").is_archived)
        self.assertTrue(Chat.objects.get(user = user2, title = "Recipe Suggestion").is_archived)

        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertFalse(c.is_archived)

class UnarchiveChats(TestCase):
    def test(self):
        user1 = self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 200)

        Chat.objects.create(user = user1, title = "Greetings", is_archived = True)

        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 200)

        self.assertFalse(Chat.objects.get(user = user1, title = "Greetings").is_archived)

        Chat.objects.create(user = user1, title = "Travel Advice", is_archived = True)
        Chat.objects.create(user = user1, title = "Math Help", is_archived = True)

        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 200)

        self.assertFalse(Chat.objects.get(user = user1, title = "Travel Advice").is_archived)
        self.assertFalse(Chat.objects.get(user = user1, title = "Math Help").is_archived)

        user1.chats.update(is_archived = True)
        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertTrue(c.is_archived)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")

        Chat.objects.create(user = user2, title = "Math Question", is_archived = True)
        Chat.objects.create(user = user2, title = "Recipe Suggestion", is_archived = True)

        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Chat.objects.get(user = user2, title = "Math Question").is_archived)
        self.assertFalse(Chat.objects.get(user = user2, title = "Recipe Suggestion").is_archived)

        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertTrue(c.is_archived)

class DeleteChats(TestCase):
    def test(self):
        user1 = self.create_and_login_user()
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 204)

        Chat.objects.create(user = user1, title = "Test chat 1")
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 2")
        Chat.objects.create(user = user1, title = "Test chat 3")

        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 4")
        Chat.objects.create(user = user1, title = "Test chat 5")

        self.logout_user()
        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        Chat.objects.create(user = user2, title = "Test chat 6")
        Chat.objects.create(user = user2, title = "Test chat 7")
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 2)
        self.assertEqual(Chat.objects.first().user, user1)
        self.assertEqual(Chat.objects.last().user, user1)

class StopPendingChats(TestCase):
    def test(self):
        user1 = self.create_and_login_user()

        chat1 = Chat.objects.create(user = user1, title = "Greetings")
        chat2 = Chat.objects.create(user = user1, title = "Math Help")

        chat1.pending_message = Message.objects.create(chat = chat1, text = "Hello!", is_from_user = True)
        chat1.save()
        chat2.pending_message = Message.objects.create(chat = chat2, text = "What is 2 + 5?", is_from_user = True)
        chat2.save()

        for c in Chat.objects.all():
            self.assertIsNotNone(c.pending_message)

        response = self.client.patch("/api/stop-pending-chats/")
        self.assertEqual(response.status_code, 200)

        for c in Chat.objects.all():
            self.assertIsNone(c.pending_message)

        chat1.pending_message = Message.objects.filter(chat__user = user1).first()
        chat1.save()
        chat2.pending_message = Message.objects.filter(chat__user = user1).last()
        chat2.save()

        for c in Chat.objects.all():
            self.assertIsNotNone(c.pending_message)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = Chat.objects.create(user = user2, title = "Travel Advice")
        chat4 = Chat.objects.create(user = user2, title = "Recipe Suggestion")

        chat3.pending_message = Message.objects.create(chat = chat1, text = "Where should I travel to?", is_from_user = True)
        chat3.save()
        chat4.pending_message = Message.objects.create(chat = chat2, text = "I have eggs and spinach. What can I make?", is_from_user = True)
        chat4.save()

        for c in Chat.objects.all():
            self.assertIsNotNone(c.pending_message)

        response = self.client.patch("/api/stop-pending-chats/")
        self.assertEqual(response.status_code, 200)

        for c in Chat.objects.filter(user__email = "someone@example.com"):
            self.assertIsNone(c.pending_message)
        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertIsNotNone(c.pending_message)

class GetMessageFileContent(TestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/get-message-file-content/", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "message_file_id": ["This field is required."]})

        response = self.client.get("/api/get-message-file-content/?chat_uuid=123", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."], "message_file_id": ["This field is required."]})

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={uuid.uuid4()}&message_file_id=1", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

        chat1 = Chat.objects.create(user = user, title = "File Analysis")
        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat1.uuid}&message_file_id=1", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Message file was not found."})

        message1 = Message.objects.create(chat = chat1, text = "Describe the file.", is_from_user = True)
        message_file1 = MessageFile.objects.create(
            message = message1,
            name = "document.txt",
            content = "This is a document about...".encode(),
            content_type = "text/plain"
        )

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat1.uuid}&message_file_id={message_file1.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, "This is a document about...".encode())

        chat2 = Chat.objects.create(user = user, title = "Another File Analysis")
        message2 = Message.objects.create(chat = chat2, text = "Describe the files.", is_from_user = True)
        message_file2 = MessageFile.objects.create(
            message = message2,
            name = "another_document.txt",
            content = "This is another document about...".encode(),
            content_type = "text/plain"
        )
        message_file3 = MessageFile.objects.create(
            message = message2,
            name = "yet_another_document.txt",
            content = "This is yet another document about...".encode(),
            content_type = "text/plain"
        )

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat2.uuid}&message_file_id={message_file2.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, "This is another document about...".encode())

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat2.uuid}&message_file_id={message_file3.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, "This is yet another document about...".encode())

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat1.uuid}&message_file_id={message_file3.id}")
        self.assertEqual(response.status_code, 404)

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat2.uuid}&message_file_id={message_file1.id}")
        self.assertEqual(response.status_code, 404)

class GetMessageFileIDs(TestCase):
    def test(self):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "File Analysis")
        message1 = chat.messages.create(text = "Describe the files.", is_from_user = True)
        message1.files.bulk_create([
            MessageFile(message = message1, name = f"File {i + 1}.txt", content = f"Document {i + 1}".encode(), content_type = "text/plain")
            for i in range(5)
        ])

        response = self.client.get(f"/api/get-message-file-ids/?chat_uuid={chat.uuid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [[1, 2, 3, 4, 5]])

        message2 = chat.messages.create(text = "Describe these other files.", is_from_user = True)
        message2.files.bulk_create([
            MessageFile(message = message2, name = f"File {i + 1}.txt", content = f"Document {i + 1}".encode(), content_type = "text/plain")
            for i in range(5, 10)
        ])

        response = self.client.get(f"/api/get-message-file-ids/?chat_uuid={chat.uuid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]])

class GetMessages(TestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/get-messages/?chat_uuid=849087f8-4b3f-47f1-980d-5a5a3d325912")
        self.assertEqual(response.status_code, 404)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.get("/api/get-messages/?chat_uuid=invalid_uuid")
        self.assertEqual(response.status_code, 400)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

        user_message_1 = Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        bot_message_1 = Message.objects.create(chat = chat, text = "Hi!", is_from_user = False)

        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"id": user_message_1.id, "text": "Hello!", "is_from_user": True, "files": [], "model": ""},
            {"id": bot_message_1.id, "text": "Hi!", "is_from_user": False, "files": [], "model": ""}
        ]
        self.assertEqual(response.json(), expected_messages)

        user_message_2 = Message.objects.create(chat = chat, text = "Hello again!", is_from_user = True)
        bot_message_2 = Message.objects.create(chat = chat, text = "Hi again!", is_from_user = False)

        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"id": user_message_1.id, "text": "Hello!", "is_from_user": True, "files": [], "model": ""},
            {"id": bot_message_1.id, "text": "Hi!", "is_from_user": False, "files": [], "model": ""},
            {"id": user_message_2.id, "text": "Hello again!", "is_from_user": True, "files": [], "model": ""},
            {"id": bot_message_2.id, "text": "Hi again!", "is_from_user": False, "files": [], "model": ""}
        ]
        self.assertEqual(response.json(), expected_messages)

class NewMessage(TestCase):
    @patch("chat.views.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user = self.create_and_login_user()

        file1 = SimpleUploadedFile("file1.txt", b"hello world", "text/plain")
        data = {"chat_uuid": "", "text": "Hello assistant!", "model": "SmolLM2-135M", "files": [file1]}

        response = self.client.post("/api/new-message/", data, format = "multipart")
        self.assertEqual(response.status_code, 200)

        chats = Chat.objects.filter(user = user)
        self.assertEqual(chats.count(), 1)

        chat = chats.first()
        self.assertIsNotNone(chat)

        self.assertIn("uuid", response.data)
        self.assertEqual(response.data["uuid"], str(chat.uuid))

        messages = Message.objects.filter(chat = chat).order_by("created_at")
        self.assertEqual(messages.count(), 2)

        user_message = messages[0]
        bot_message = messages[1]

        self.assertTrue(user_message.is_from_user)
        self.assertEqual(user_message.text, "Hello assistant!")

        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(bot_message.model, "SmolLM2-135M")
        self.assertEqual(bot_message.text, "")

        chat.refresh_from_db()
        self.assertEqual(chat.pending_message, bot_message)

        files = MessageFile.objects.filter(message = user_message)
        self.assertEqual(files.count(), 1)

        file = files.first()
        self.assertEqual(file.name, "file1.txt")
        self.assertEqual(file.content, b"hello world")
        self.assertEqual(file.content_type, "text/plain")

        mock_generate.assert_called_once()
        call_arguments = mock_generate.call_args[0]

        self.assertEqual(call_arguments[0], chat)
        self.assertTrue(call_arguments[1])

    @patch("chat.views.is_any_user_chat_pending", return_value = True)
    def test_cannot_send_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "A chat is already pending."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.generate_pending_message_in_chat")
    def test_creates_new_chat_without_chat_uuid(self, mock_task, _):
        self.create_and_login_user()

        response = self.client.post("/api/new-message/", {"text": "Hello!"}, format = "multipart")
        self.assertEqual(response.status_code, 200)

        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)

        user_message = Message.objects.first()
        self.assertEqual(user_message.text, "Hello!")
        self.assertTrue(user_message.is_from_user)

        bot_message = Message.objects.last()
        self.assertEqual(bot_message.text, "")
        self.assertFalse(bot_message.is_from_user)

        chat = Chat.objects.first()
        self.assertEqual(chat.pending_message, bot_message)

        mock_task.assert_called_once()
        arguments, _ = mock_task.call_args

        self.assertEqual(arguments[0], chat)
        self.assertTrue(arguments[1])

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.generate_pending_message_in_chat")
    def test_post_to_existing_chat(self, mock_task, _):
        user = self.create_and_login_user()
        chat = Chat.objects.create(user = user, title = "Test Chat")

        response = self.client.post("/api/new-message/", {"chat_uuid": str(chat.uuid), "text": "hello"}, format = "multipart")
        self.assertEqual(response.status_code, 200)

        self.assertEqual(Chat.objects.count(), 1)
        chat.refresh_from_db()
        self.assertEqual(chat.pending_message, Message.objects.get(is_from_user = False))

        mock_task.assert_called_once()
        arguments, _ = mock_task.call_args
        self.assertFalse(arguments[1])

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_chat_was_not_found(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"chat_uuid": str(uuid.uuid4()), "text": "hello"}, format = "multipart")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_invalid_chat_uuid_format(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"chat_uuid": "NOT-A-UUID", "text": "hello"}, format = "multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_invalid_model(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"chat_uuid": "", "text": "hello", "model": "INVALID"}, format = "multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"model": ['"INVALID" is not a valid choice.']})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_too_many_files(self, _):
        self.create_and_login_user()
        files = [SimpleUploadedFile(f"file{i + 1}.txt", f"Document {i + 1}".encode(), "text/plain") for i in range(11)]
        data = {"chat_uuid": "", "text": "Describe the files.", "model": "SmolLM2-135M", "files": files}
        response = self.client.post("/api/new-message/", data, format = "multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"files": ["Ensure this field has no more than 10 elements."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_files_too_large(self, _):
        self.create_and_login_user()

        def post_and_assert(files: list[SimpleUploadedFile]):
            data = {"chat_uuid": "", "text": "Describe the file.", "model": "SmolLM2-135M", "files": files}
            response = self.client.post("/api/new-message/", data, format = "multipart")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"files": ["Total file size exceeds limit of 5 MB."]})

        test_sizes = [
            [5_000_001],
            [2_500_000, 2_500_001],
            [1_000_000 for _ in range(5)],
            [1_000_000 for _ in range(10)]
        ]
        test_sizes[2][-1] += 1
        test_sizes[3][-1] += 1

        for sizes in test_sizes:
            files = []
            for i, s in enumerate(sizes):
                files.append(SimpleUploadedFile(f"file{i + 1}.txt", bytes([b % 255 for b in range(s)]), "text/plain"))
            post_and_assert(files)

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.generate_pending_message_in_chat")
    def test_temporary_chat(self, _1, _2):
        user = self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"text": "Hello!", "temporary": True}, format = "multipart")
        self.assertEqual(response.status_code, 200)

        self.assertTrue(User.objects.count(), 1)
        self.assertEqual(user.chats.count(), 1)

        chat = user.chats.first()
        self.assertEqual(chat.title, "Chat 1")
        self.assertIsNotNone(chat.pending_message)
        self.assertTrue(chat.is_temporary)
        self.assertFalse(chat.is_archived)

        self.assertTrue(Message.objects.count(), 2)
        self.assertEqual(chat.messages.count(), 2)

        user_message = chat.messages.first()
        self.assertEqual(user_message.text, "Hello!")
        self.assertTrue(user_message.is_from_user)
        self.assertEqual(user_message.model, "")

        bot_message = chat.messages.last()
        self.assertEqual(bot_message.text, "")
        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(bot_message.model, "SmolLM2-135M")

class EditMessage(TestCase):
    @patch("chat.views.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user = self.create_and_login_user()

        chat = Chat.objects.create(user = user, title = "Greetings")
        user_message = Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        bot_message = Message.objects.create(chat = chat, text = "Hello! How can I help you today?", is_from_user = False)

        data = {"chat_uuid": str(chat.uuid), "index": 0, "text": "Hi! How are you?"}

        body = encode_multipart(BOUNDARY, data)
        content_type = f"multipart/form-data; boundary={BOUNDARY}"

        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        chat.refresh_from_db()
        user_message.refresh_from_db()
        bot_message.refresh_from_db()
        self.assertEqual(chat.title, "Greetings")
        self.assertEqual(chat.pending_message, bot_message)
        self.assertEqual(user_message.text, "Hi! How are you?")
        self.assertEqual(bot_message.text, "")
        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)

        mock_generate.assert_called_once()
        call_arguments = mock_generate.call_args[0]

        self.assertEqual(call_arguments[0], chat)

    @patch("chat.views.is_any_user_chat_pending", return_value = True)
    def test_cannot_edit_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/edit-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "A chat is already pending."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_chat_uuid_and_index(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/edit-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "index": ["This field is required."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_chat_uuid(self, _):
        self.create_and_login_user()
        for chat_uuid in ["", "NOT-A-UUID", "123", "abdc5678"]:
            body = encode_multipart(BOUNDARY, {"chat_uuid": chat_uuid, "index": 0})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/edit-message/", body, content_type)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_chat_was_not_found(self, _):
        self.create_and_login_user()
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(uuid.uuid4()), "index": 0})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_index(self, _):
        user = self.create_and_login_user()
        chat = Chat.objects.create(user = user, title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["This field is required."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_model(self, _):
        user = self.create_and_login_user()
        chat = Chat.objects.create(user = user, title = "Greetings")
        Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)," index": 0, "model": "INVALID"})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"model": ['"INVALID" is not a valid choice.']})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_too_many_files(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "File Analysis")
        message = chat.messages.create(text = "Describe the files.", is_from_user = True)
        message.files.bulk_create([
            MessageFile(message = message, name = f"file{i + 1}.txt", content = f"Document {i + 1}".encode(), content_type = "text/plain")
            for i in range(5)
        ])
        chat.messages.create(text = "The files are about...", is_from_user = False)

        files = [SimpleUploadedFile(f"file{i + 6}.txt", f"Document {i + 6}".encode(), "text/plain") for i in range(6)]
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "text": "Describe the files.", "index": 0, "added_files": files})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Total number of files exceeds the limit of 10."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_files_too_large(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "File Analysis")
        chat.messages.create(text = "Describe the files.", is_from_user = True)
        chat.messages.create(text = "The files are about...", is_from_user = False)

        def post_and_assert(files: list[SimpleUploadedFile]):
            body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "text": "Describe the files.", "index": 0, "added_files": files})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/edit-message/", body, content_type)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"detail": "Total file size exceeds limit of 5 MB."})

        test_sizes = [
            [5_000_001],
            [2_500_000, 2_500_001],
            [1_000_000 for _ in range(5)],
            [1_000_000 for _ in range(10)]
        ]
        test_sizes[2][-1] += 1
        test_sizes[3][-1] += 1

        for sizes in test_sizes:
            files = []
            for i, s in enumerate(sizes):
                files.append(SimpleUploadedFile(f"file{i + 1}.txt", bytes([b % 255 for b in range(s)]), "text/plain"))
            post_and_assert(files)

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_remove_files(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(user = user, title = "File Analysis")
        message = chat.messages.create(chat = chat, text = "Describe the files.", is_from_user = True)
        message.files.bulk_create([
            MessageFile(message = message, name = f"File {i + 1}.txt", content = f"Content {i + 1}".encode(), content_type = "text/plain") 
            for i in range(5)
        ])
        chat.messages.create(chat = chat, text = "The files are about...", is_from_user = False)

        self.assertEqual(MessageFile.objects.count(), 5)
        for i, f in enumerate(MessageFile.objects.all()):
            self.assertEqual(f"File {i + 1}.txt", f.name)

        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "text": "Describe the files.", "index": 0, "removed_file_ids": [2, 4]})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        self.assertEqual(MessageFile.objects.count(), 3)
        for i, f in zip([1, 3, 5], MessageFile.objects.all()):
            self.assertEqual(f"File {i}.txt", f.name)

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_index_out_of_range(self, _):
        def test(chat: Chat, index: int):
            body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": index})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/edit-message/", body, content_type)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"detail": "Index out of range."})

        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        test(chat, 0)

        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False)
        test(chat, 1)

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_negative_index(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": -1})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["Ensure this value is greater than or equal to 0."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_add_and_remove_files(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(user = user, title = "File Analysis")
        message = chat.messages.create(chat = chat, text = "Describe the files.", is_from_user = True)
        message.files.bulk_create([
            MessageFile(message = message, name = f"File {i + 1}.txt", content = f"Content {i + 1}".encode(), content_type = "text/plain") 
            for i in range(5)
        ])
        chat.messages.create(chat = chat, text = "The files are about...", is_from_user = False, model = "SmolLM2-135M")

        added_files = [SimpleUploadedFile(f"File {i + 6}.txt", f"Document {i + 6}".encode(), "text/plain") for i in range(2)]
        body = encode_multipart(
            BOUNDARY,
            {
                "chat_uuid": str(chat.uuid),
                "text": "Describe the files.",
                "index": 0,
                "added_files": added_files,
                "removed_file_ids": [1, 3, 4]
            }
        )
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        self.assertEqual(MessageFile.objects.count(), 4)
        message.refresh_from_db()
        self.assertEqual(message.files.count(), 4)
        for file, i in zip(message.files.order_by("created_at"), [2, 5, 6, 7]):
            self.assertEqual(file.name, f"File {i}.txt")

        self.assertEqual(Message.objects.count(), 2)
        self.assertEqual(Message.objects.last().text, "")

class RegenerateMessage(TestCase):
    @patch("chat.views.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user = self.create_and_login_user()
        chat = Chat.objects.create(user = user, title = "Greetings")
        user_message = Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        bot_message = Message.objects.create(chat = chat, text = "Hello! How can I help you today?", is_from_user = False, model = "SmolLM2-135M")

        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": 1, "model": "SmolLM2-360M"})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        chat.refresh_from_db()
        user_message.refresh_from_db()
        bot_message.refresh_from_db()

        self.assertEqual(chat.title, "Greetings")
        self.assertEqual(chat.pending_message, bot_message)

        self.assertTrue(user_message.text, "Hello!")
        self.assertTrue(user_message.is_from_user)

        self.assertEqual(bot_message.text, "")
        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(bot_message.model, "SmolLM2-360M")

        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)
        self.assertEqual(MessageFile.objects.count(), 0)

        mock_generate.assert_called_once()

        self.assertEqual(mock_generate.call_args[0][0], chat)
        self.assertTrue(mock_generate.call_args[1]["should_randomize"])

    @patch("chat.views.is_any_user_chat_pending", return_value = True)
    def test_cannot_regenerate_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/regenerate-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "A chat is already pending."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_chat_uuid_and_index(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/regenerate-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "index": ["This field is required."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_chat_uuid(self, _):
        self.create_and_login_user()
        for chat_uuid in ["", "NOT-A-UUID", "123", "abdc5678"]:
            body = encode_multipart(BOUNDARY, {"chat_uuid": chat_uuid, "index": 0})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/regenerate-message/", body, content_type)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_chat_was_not_found(self, _):
        self.create_and_login_user()
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(uuid.uuid4()), "index": 0})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_index(self, _):
        user = self.create_and_login_user()
        chat = Chat.objects.create(user = user, title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["This field is required."]})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_model(self, _):
        user = self.create_and_login_user()
        chat = Chat.objects.create(user = user, title = "Greetings")
        Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        Message.objects.create(chat = chat, text = "Hello! How can I help you today?", is_from_user = False)
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)," index": 1, "model": "INVALID"})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"model": ['"INVALID" is not a valid choice.']})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_index_out_of_range(self, _):
        def test(chat: Chat, index: int):
            body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": index})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/regenerate-message/", body, content_type)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"detail": "Index out of range."})

        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        test(chat, 0)

        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False)
        test(chat, 2)

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    def test_negative_index(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": -1})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["Ensure this value is greater than or equal to 0."]})

class TestRequireAuthentication(TestCase):
    def test(self):
        urls = [f"/api/{p.pattern}" for p in urlpatterns]
        for url in ["/api/signup/", "/api/login/", "/api/verify-mfa/", "/api/refresh/"]:
            urls.remove(url)

        for url in urls:
            responses = [
                method(url, **{"HTTP_ACCEPT": "application/json"})
                for method in [self.client.get, self.client.post, self.client.patch, self.client.delete]
            ]

            for response in responses:
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {"detail": "Authentication credentials were not provided."})