import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone

from django.contrib.auth.hashers import check_password
from django.core import mail
from django.utils import timezone
from freezegun import freeze_time
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from ..utils import ViewsTestCase, create_user
from ...models import EmailVerificationToken, GuestIdentity, PreAuthToken, User, UserMFA, UserSession, derive_token_fingerprint
from ...urls.api import urlpatterns

class Signup(ViewsTestCase):
    def test(self):
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.all().count(), 1)
        self.assertEqual(EmailVerificationToken.objects.count(), 1)
        user: User = User.objects.first()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertFalse(user.has_verified_email)
        self.assertFalse(user.is_active)
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

        control_characters = [chr(i) for i in range(0x00, 0x20)]
        control_characters.append(chr(0x7F))
        control_characters.extend(chr(i) for i in range(0x80, 0xA0))
        self.assertEqual(len(control_characters), 65)

        test(f"onepassword{control_characters[0]}", {"password": ["Null characters are not allowed."]})
        test(f"{control_characters[0]}onepassword", {"password": ["Null characters are not allowed."]})
        test(f"one{control_characters[0]}password", {"password": ["Null characters are not allowed."]})
        control_characters.pop(0)

        for control_character in control_characters:
            test(f"onepassword{control_character}", {"password": ["Password cannot contain control characters."]})
            test(f"{control_character}onepassword", {"password": ["Password cannot contain control characters."]})
            test(f"{control_character} onepassword", {"password": ["Password cannot contain control characters."]})
            test(f"onepassword {control_character}", {"password": ["Password cannot contain control characters."]})
            test(f"one{control_character}password", {"password": ["Password cannot contain control characters."]})
            test(f"one {control_character} password", {"password": ["Password cannot contain control characters."]})
            test("".join([control_character for _ in range(12)]), {"password": ["Password cannot contain control characters."]})
            test(f" {"".join([control_character for _ in range(12)])} ", {"password": ["Password cannot contain control characters."]})
            test(" ".join([control_character for _ in range(12)]), {"password": ["Password cannot contain control characters."]})
            test(f" {" ".join([control_character for _ in range(12)])} ", {"password": ["Password cannot contain control characters."]})

class VerifyEmail(ViewsTestCase):
    def test(self):
        email = "test@example.com"
        password = "testpassword"

        response = self.client.post("/api/signup/", {"email": email, "password": password})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.content, b"")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        token = re.search(r"token=([^\s]+)", mail.outbox[0].body).group(1)

        response = self.client.post("/api/verify-email/", {"email": email, "token": token})
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 2)
            self.assertIn("access_token", cookies)
            self.assertIn("refresh_token", cookies)

            for _, cookie in cookies.items():
                self.assertTrue(cookie["httponly"])
                self.assertEqual(cookie["samesite"], "Strict")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

    def test_requires_email_and_token(self):
        response = self.client.post("/api/verify-email/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"email": ["This field is required."], "token": ["This field is required."]})

    def test_requires_valid_email(self):
        email = "test@example.com"
        password = "testpassword"

        response = self.client.post("/api/signup/", {"email": email, "password": password})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.content, b"")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        token = re.search(r"token=([^\s]+)", mail.outbox[0].body).group(1)

        response = self.client.post("/api/verify-email/", {"email": "invalid@example.com", "token": token})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content, b"")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

    def test_requires_valid_token(self):
        email = "test@example.com"
        password = "testpassword"

        response = self.client.post("/api/signup/", {"email": email, "password": password})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.content, b"")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/verify-email/", {"email": email, "token": "invalid"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content, b"")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

    def test_requires_non_expired_token(self):
        email = "test@example.com"
        password = "testpassword"

        time_to_freeze = timezone.datetime(2025, 1, 1, 12)
        with freeze_time(time_to_freeze):
            response = self.client.post("/api/signup/", {"email": email, "password": password})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.content, b"")

            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

            token = re.search(r"token=([^\s]+)", mail.outbox[0].body).group(1)

        with freeze_time(time_to_freeze + timedelta(hours = 24)):
            response = self.client.post("/api/verify-email/", {"email": email, "token": token})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.content, b"")

            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

class Login(ViewsTestCase):
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
        response = self.client.post("/api/verify-mfa/", {"token": token, "code": UserMFA.generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 2)
            self.assertIn("access_token", cookies)
            self.assertIn("refresh_token", cookies)

            for _, cookie in cookies.items():
                self.assertTrue(cookie["httponly"])
                self.assertEqual(cookie["samesite"], "Strict")

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

    def test_does_not_activate_mutiple_same_sessions(self):
        user = create_user()
        self.assertEqual(user.sessions.count(), 0)

        self.login_user()
        self.assertEqual(user.sessions.count(), 1)

        session1 = user.sessions.order_by("login_at").first()
        self.assertIsNone(session1.logout_at)

        self.login_user()
        self.assertEqual(user.sessions.count(), 2)

        session1.refresh_from_db()
        self.assertIsNotNone(session1.logout_at)

        session2 = user.sessions.order_by("login_at").last()
        self.assertIsNone(session2.logout_at)

    def test_with_inactive_user(self):
        user = create_user()
        user.is_active = False
        user.save()
        response = self.login_user()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "login.error"})
        self.assertFalse(UserSession.objects.count(), 0)
        self.assertFalse(PreAuthToken.objects.count(), 0)

    def test_with_guest_user(self):
        identity, token = GuestIdentity.create("", "")
        response = self.login_user(identity.user.email, token)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "login.error"})
        self.assertFalse(UserSession.objects.count(), 0)
        self.assertFalse(PreAuthToken.objects.count(), 0)

class Logout(ViewsTestCase):
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

    def test_without_refresh_token(self):
        self.create_and_login_user()
        self.assertEqual(len(self.client.cookies.items()), 2)
        self.assertNotEqual(self.client.cookies["access_token"].value, "")
        self.assertNotEqual(self.client.cookies["refresh_token"].value, "")

        self.assertEqual(UserSession.objects.count(), 1)
        self.assertIsNone(UserSession.objects.first().logout_at)

        self.client.cookies.pop("refresh_token")
        self.assertEqual(len(self.client.cookies), 1)
        self.assertIn("access_token", self.client.cookies)

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

class LogoutAllSessions(ViewsTestCase):
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

class Refresh(ViewsTestCase):
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

class SetupMFA(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

        response = self.client.post("/api/setup-mfa/", {"password": "testpassword"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        auth_url = response.json()["auth_url"]
        secret = response.json()["secret"]

        self.assertEqual(auth_url, f"otpauth://totp/Chatbot:test%40example.com?secret={secret}&issuer=Chatbot")
        self.assertNotEqual(secret, user.mfa.secret)

        user.refresh_from_db()
        self.assertNotEqual(user.mfa.secret, b"")
        self.assertEqual(len(user.mfa.secret), 140)
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_requires_non_guest_user(self):
        response = self.client.post("/api/authenticate-as-guest/")
        self.assertEqual(response.status_code, 201)

        response = self.client.post("/api/setup-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Guest users cannot set up MFA."})

    def test_requires_to_be_disabled(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()

        response = self.client.post("/api/setup-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "MFA is already enabled for the current user. First disable MFA before setting it up again."})

    def test_requires_password(self):
        user = self.create_and_login_user()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

        response = self.client.post("/api/setup-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"password": ["This field is required."]})

        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_invalid_password(self):
        user = self.create_and_login_user()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

        response = self.client.post("/api/setup-mfa/", {"password": "invalid"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidPassword"})

        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_overwrites_secret(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        previous_encrypted_secret = user.mfa.secret

        response = self.client.post("/api/setup-mfa/", {"password": "testpassword"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        auth_url = response.json()["auth_url"]
        secret = response.json()["secret"]

        self.assertEqual(auth_url, f"otpauth://totp/Chatbot:test%40example.com?secret={secret}&issuer=Chatbot")

        user.refresh_from_db()
        self.assertNotEqual(secret, user.mfa.secret)
        self.assertNotEqual(previous_encrypted_secret, user.mfa.secret)

class EnableMFA(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()

        user.mfa.setup()
        response = self.client.post("/api/enable-mfa/", {"code": UserMFA.generate_code(user.mfa.secret)})
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

    def test_requires_non_guest_user(self):
        response = self.client.post("/api/authenticate-as-guest/")
        self.assertEqual(response.status_code, 201)

        response = self.client.post("/api/enable-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Guest users cannot enable MFA."})

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

class DisableMFA(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        user.mfa.setup()
        user.mfa.enable()
        self.assertNotEqual(user.mfa.secret, b"")
        self.assertNotEqual(user.mfa.backup_codes, [])
        self.assertTrue(user.mfa.is_enabled)

        response = self.client.post("/api/disable-mfa/", {"code": UserMFA.generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        user = User.objects.get(email = "test@example.com")
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_requires_non_guest_user(self):
        response = self.client.post("/api/authenticate-as-guest/")
        self.assertEqual(response.status_code, 201)

        response = self.client.post("/api/disable-mfa/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Guest users cannot have MFA."})

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

class VerifyMFA(ViewsTestCase):
    def test(self):
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
        self.assertEqual(len(token), 43)

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/verify-mfa/", {"token": token, "code": UserMFA.generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies), 2)
            self.assertIn("access_token", cookies)
            self.assertIn("refresh_token", cookies)

            for _, cookie in cookies.items():
                self.assertTrue(cookie["httponly"])
                self.assertEqual(cookie["samesite"], "Strict")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

    def test_invalid_or_expired_code(self):
        response = self.client.post("/api/verify-mfa/", {"token": secrets.token_urlsafe(32), "code": "123456"})
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
            self.assertEqual(response.json(), {"detail": "mfa.messages.errorInvalidOrExpiredCode"})

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
            self.assertEqual(access_token["samesite"], "Strict")

            refresh_token = dict(response.cookies["refresh_token"].items())
            self.assertTrue(refresh_token["httponly"])
            self.assertEqual(refresh_token["samesite"], "Strict")

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

        response = self.client.post("/api/verify-mfa/", {"token": token, "code": UserMFA.generate_code(user.mfa.secret)})
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

        response = self.client.post("/api/verify-mfa/", {"token": "invalid", "code": UserMFA.generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 401)

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

    def test_does_not_activate_mutiple_same_sessions(self):
        user = create_user()
        user.mfa.setup()
        user.mfa.enable()

        self.assertEqual(user.sessions.count(), 0)

        response = self.login_user()
        self.assertEqual(response.status_code, 200)
        response = self.client.post("/api/verify-mfa/", {"token": response.json()["token"], "code": UserMFA.generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)

        self.assertEqual(user.sessions.count(), 1)

        session1 = user.sessions.order_by("login_at").first()
        self.assertIsNone(session1.logout_at)

        response = self.login_user()
        self.assertEqual(response.status_code, 200)
        response = self.client.post("/api/verify-mfa/", {"token": response.json()["token"], "code": UserMFA.generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)

        self.assertEqual(user.sessions.count(), 2)

        session1.refresh_from_db()
        self.assertIsNotNone(session1.logout_at)

        session2 = user.sessions.order_by("login_at").last()
        self.assertIsNone(session2.logout_at)

class Me(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

        expected_json = {
            "email": user.email,
            "is_guest": False,
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
            "is_guest": False,
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

class DeleteAccount(ViewsTestCase):
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
        response = self.client.delete("/api/delete-account/", {"password": "testpassword", "mfa_code": UserMFA.generate_code(user2.mfa.secret)}, "application/json")
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

class RequestPasswordReset(ViewsTestCase):
    def test_returns_200_for_existing_email(self):
        self.create_and_login_user()
        response = self.client.post("/api/request-password-reset/", {"email": "test@example.com"})
        self.assertEqual(response.status_code, 200)

    def test_returns_200_for_non_existing_email(self):
        response = self.client.post("/api/request-password-reset/", {"email": "test@example.com"})
        self.assertEqual(response.status_code, 200)

    def test_email_sent_for_existing_user(self):
        self.create_and_login_user()
        self.client.post("/api/request-password-reset/", {"email": "test@example.com"})
        self.assertEqual(len(mail.outbox), 1)

    def test_no_email_sent_for_unknown_user(self):
        self.client.post("/api/request-password-reset/", {"email": "test@example.com"})
        self.assertEqual(len(mail.outbox), 0)

    def test_token_is_hashed_in_database(self):
        user = self.create_and_login_user()
        self.client.post("/api/request-password-reset/", {"email": "test@example.com"})

        reset_token = user.password_reset_tokens.first()
        raw_token = re.search(r"token=([^\s]+)", mail.outbox[0].body).group(1)

        self.assertNotEqual(raw_token, reset_token.token_fingerprint)
        self.assertEqual(derive_token_fingerprint(raw_token), reset_token.token_fingerprint)

class ConfirmPasswordReset(ViewsTestCase):
    def test_password_reset_success(self):
        user = self.create_and_login_user()
        raw_token = "test-reset-token"
        reset_token = user.password_reset_tokens.create(
            token_fingerprint = derive_token_fingerprint(raw_token),
            ip_address = "127.0.0.1",
            user_agent_hash = "test",
            expires_at = timezone.now() + timedelta(minutes = 15)
        )

        response = self.client.post("/api/confirm-password-reset/", {"token": raw_token, "password": "somepassword"})
        self.assertEqual(response.status_code, 204)

        user.refresh_from_db()
        self.assertTrue(user.check_password("somepassword"))

        reset_token.refresh_from_db()
        self.assertIsNotNone(reset_token.used_at)

    def test_token_cannot_be_reused(self):
        user = self.create_and_login_user()
        raw_token = "test-reset-token"
        user.password_reset_tokens.create(
            token_fingerprint = derive_token_fingerprint(raw_token),
            ip_address = "127.0.0.1",
            user_agent_hash = "test",
            expires_at = timezone.now() + timedelta(minutes = 15)
        )

        response = self.client.post("/api/confirm-password-reset/", {"token": raw_token, "password": "somepassword"})
        self.assertEqual(response.status_code, 204)

        response = self.client.post("/api/confirm-password-reset/", {"token": raw_token, "password": "someotherpassword"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "auth.resetPassword.invalid"})

    def test_expired_token_is_rejected(self):
        user = self.create_and_login_user()
        raw_token = "test-reset-token"
        reset_token = user.password_reset_tokens.create(
            token_fingerprint = derive_token_fingerprint(raw_token),
            ip_address = "127.0.0.1",
            user_agent_hash = "test",
            expires_at = timezone.now() + timedelta(minutes = 15)
        )

        reset_token.expires_at = timezone.now() - timedelta(seconds = 1)
        reset_token.save()

        response = self.client.post("/api/confirm-password-reset/", {"token": raw_token, "password": "somepassword"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "auth.resetPassword.invalid"})

    def test_invalid_token_is_rejected(self):
        self.create_and_login_user()
        response = self.client.post("/api/confirm-password-reset/", {"token": "invalid", "password": "somepassword"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "auth.resetPassword.invalid"})

    def test_weak_password_rejected(self):
        response = self.client.post("/api/confirm-password-reset/", {"token": "invalid", "password": "123"})
        self.assertEqual(response.json(), {"password": ["Ensure this field has at least 12 characters."]})

    def test_refresh_tokens_are_revoked(self):
        user = self.create_and_login_user()
        raw_token = "test-reset-token"
        user.password_reset_tokens.create(
            token_fingerprint = derive_token_fingerprint(raw_token),
            ip_address = "127.0.0.1",
            user_agent_hash = "test",
            expires_at = timezone.now() + timedelta(minutes = 15)
        )

        OutstandingToken.objects.create(
            user = user,
            jti = "abc",
            token = "dummy",
            expires_at = timezone.now() + timedelta(days = 1)
        )

        response = self.client.post("/api/confirm-password-reset/", {"token": raw_token, "password": "somepassword"})
        self.assertEqual(response.status_code, 204)

        self.assertEqual(OutstandingToken.objects.filter(user = user).count(), 0)

class AuthenticateAsGuest(ViewsTestCase):
    def test(self):
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GuestIdentity.objects.count(), 0)
        self.assertEqual(len(self.client.cookies.items()), 0)

        response = self.client.post("/api/authenticate-as-guest/")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 3)
        self.assertEqual(len(self.client.cookies.items()), 3)

        for cookie_name in ["access_token", "refresh_token", "guest_token"]:
            self.assertIn(cookie_name, response.cookies)
            self.assertIn(cookie_name, self.client.cookies)
            self.assertTrue(response.cookies[cookie_name]["httponly"])
            self.assertTrue(self.client.cookies[cookie_name]["httponly"])
            self.assertEqual(response.cookies[cookie_name]["samesite"], "Strict")
            self.assertEqual(self.client.cookies[cookie_name]["samesite"], "Strict")

        self.assertEqual(GuestIdentity.objects.count(), 1)
        self.assertEqual(User.objects.count(), 1)

        identity = GuestIdentity.objects.first()
        user: User = User.objects.first()

        self.assertEqual(identity.user, user)
        self.assertHasAttr(identity, "expires_at")
        self.assertHasAttr(identity, "last_used_at")
        self.assertHasAttr(identity, "created_at")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies["guest_token"].value), 43)

        self.assertEqual(len(user.email), 42 + len("@example.com"))
        self.assertEqual(len(user.password), 89)
        self.assertTrue(user.email.endswith("@example.com"))
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_guest)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

        self.assertHasAttr(user, "chats")
        self.assertHasAttr(user, "preferences")
        self.assertHasAttr(user, "sessions")
        self.assertHasAttr(user, "mfa")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

    def test_existing_guest_token(self):
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GuestIdentity.objects.count(), 0)
        self.assertAlmostEqual(len(self.client.cookies.items()), 0)

        identity, token = GuestIdentity.create("", "")
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(GuestIdentity.objects.count(), 1)

        self.client.cookies["guest_token"] = token

        response = self.client.post("/api/authenticate-as-guest/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 3)
        self.assertEqual(len(self.client.cookies.items()), 3)

        for cookie_name in ["access_token", "refresh_token", "guest_token"]:
            self.assertIn(cookie_name, response.cookies)
            self.assertIn(cookie_name, self.client.cookies)
            self.assertTrue(response.cookies[cookie_name]["httponly"])
            self.assertTrue(self.client.cookies[cookie_name]["httponly"])
            self.assertEqual(response.cookies[cookie_name]["samesite"], "Strict")
            self.assertEqual(self.client.cookies[cookie_name]["samesite"], "Strict")

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies["guest_token"].value), 43)

        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(GuestIdentity.objects.count(), 1)

        user: User = User.objects.first()
        self.assertEqual(identity.user, user)
        self.assertEqual(len(user.email), 42 + len("@example.com"))
        self.assertEqual(len(user.password), 89)
        self.assertTrue(user.email.endswith("@example.com"))
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_guest)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

        self.assertHasAttr(user, "chats")
        self.assertHasAttr(user, "preferences")
        self.assertHasAttr(user, "sessions")
        self.assertHasAttr(user, "mfa")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

    def test_invalid_guest_token(self):
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GuestIdentity.objects.count(), 0)
        self.assertAlmostEqual(len(self.client.cookies.items()), 0)

        for i, token in enumerate([secrets.token_urlsafe(32), str(uuid.uuid4()), "invalid"]):
            self.client.cookies["guest_token"] = token

            response = self.client.post("/api/authenticate-as-guest/")
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.content, b"")
            self.assertEqual(len(response.cookies.items()), 3)
            self.assertEqual(len(self.client.cookies.items()), 3)

            for cookie_name in ["access_token", "refresh_token", "guest_token"]:
                self.assertIn(cookie_name, response.cookies)
                self.assertIn(cookie_name, self.client.cookies)
                self.assertTrue(response.cookies[cookie_name]["httponly"])
                self.assertTrue(self.client.cookies[cookie_name]["httponly"])
                self.assertEqual(response.cookies[cookie_name]["samesite"], "Strict")
                self.assertEqual(self.client.cookies[cookie_name]["samesite"], "Strict")

            for cookies in [response.cookies, self.client.cookies]:
                self.assertEqual(len(cookies["guest_token"].value), 43)

            self.assertEqual(User.objects.count(), i + 1)
            self.assertEqual(GuestIdentity.objects.count(), i + 1)

            identity = GuestIdentity.objects.order_by("created_at").last()
            user: User = User.objects.order_by("created_at").last()

            self.assertEqual(identity.user, user)
            self.assertHasAttr(identity, "expires_at")
            self.assertHasAttr(identity, "last_used_at")
            self.assertHasAttr(identity, "created_at")

            self.assertEqual(len(user.email), 42 + len("@example.com"))
            self.assertEqual(len(user.password), 89)
            self.assertTrue(user.email.endswith("@example.com"))
            self.assertTrue(user.is_active)
            self.assertTrue(user.is_guest)
            self.assertFalse(user.is_staff)
            self.assertFalse(user.is_superuser)

            self.assertHasAttr(user, "chats")
            self.assertHasAttr(user, "preferences")
            self.assertHasAttr(user, "sessions")
            self.assertHasAttr(user, "mfa")

    def test_tampered_guest_token(self):
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(GuestIdentity.objects.count(), 0)
        self.assertAlmostEqual(len(self.client.cookies.items()), 0)

        identity, token = GuestIdentity.create("", "")
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(GuestIdentity.objects.count(), 1)

        self.client.cookies["guest_token"] = token[:-1] + ("A" if token[-1] != "A" else "B")

        response = self.client.post("/api/authenticate-as-guest/")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.content, b"")
        self.assertEqual(len(response.cookies.items()), 3)
        self.assertEqual(len(self.client.cookies.items()), 3)

        for cookie_name in ["access_token", "refresh_token", "guest_token"]:
            self.assertIn(cookie_name, response.cookies)
            self.assertIn(cookie_name, self.client.cookies)
            self.assertTrue(response.cookies[cookie_name]["httponly"])
            self.assertTrue(self.client.cookies[cookie_name]["httponly"])
            self.assertEqual(response.cookies[cookie_name]["samesite"], "Strict")
            self.assertEqual(self.client.cookies[cookie_name]["samesite"], "Strict")

        self.assertEqual(User.objects.count(), 2)
        self.assertEqual(GuestIdentity.objects.count(), 2)

        user1 = identity.user
        user2: User = User.objects.last()

        self.assertNotEqual(user1, user2)
        self.assertNotEqual(user1.email, user2.email)
        self.assertNotEqual(user1.password, user2.password)

        for cookies in [response.cookies, self.client.cookies]:
            self.assertEqual(len(cookies["guest_token"].value), 43)
            self.assertNotEqual(cookies["guest_token"].value, token)

        self.assertEqual(len(user2.email), 42 + len("@example.com"))
        self.assertEqual(len(user2.password), 89)
        self.assertTrue(user2.email.endswith("@example.com"))
        self.assertTrue(user2.is_active)
        self.assertTrue(user2.is_guest)
        self.assertFalse(user2.is_staff)
        self.assertFalse(user2.is_superuser)

        self.assertHasAttr(user2, "chats")
        self.assertHasAttr(user2, "preferences")
        self.assertHasAttr(user2, "sessions")
        self.assertHasAttr(user2, "mfa")

class TestRequireAuthentication(ViewsTestCase):
    def test(self):
        urls = [f"/api/{p.pattern}" for p in urlpatterns]
        exclude_urls = [f"/api/{u}/" for u in [
            "signup", "verify-email", "login", "refresh", "verify-mfa",
            "request-password-reset", "confirm-password-reset", "authenticate-as-guest"
        ]]
        for exclude_url in exclude_urls:
            urls.remove(exclude_url)

        for url in urls:
            responses = [
                method(url, **{"HTTP_ACCEPT": "application/json"})
                for method in [self.client.get, self.client.post, self.client.patch, self.client.delete]
            ]

            for response in responses:
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {"detail": "Authentication credentials were not provided."})