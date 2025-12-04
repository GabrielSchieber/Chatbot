import uuid
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.test import TestCase as DjangoTestCase
from django.utils import timezone
from freezegun import freeze_time
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .utils import create_user
from ..models import Chat, Message, MessageFile, User
from ..totp_utils import generate_code

class TestCase(DjangoTestCase):
    def login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        return self.client.post("/api/login/", {"email": email, "password": password})

    def logout_user(self):
        return self.client.post("/api/logout/")

    def create_and_login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        user = create_user(email, password)
        response = self.login_user(email, password)
        return user, response

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
            self.assertEqual(response.json()["error"], "Email address is invalid.")
            self.assertEqual(User.objects.all().count(), 0)

        test("test")
        test("example.com")
        test("test@example")
        test("@example")
        test("test@")
        test("test@.com")
        test("@.com")

    def test_with_invalid_password(self):
        def test(password: str):
            response = self.client.post("/api/signup/", {"email": "test@example.com", "password": password})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["error"], "Password must have between 12 and 1000 characters.")
            self.assertEqual(User.objects.all().count(), 0)

        test("")
        test("test")
        test("onepassword")
        test("".join(["password123" for _ in range(91)]))

class Login(TestCase):
    def test(self):
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", self.client.cookies)
        self.assertIn("refresh_token", self.client.cookies)

    def test_with_invalid_credentials(self):
        error = "login.error"

        create_user()
        response = self.login_user("someemail@example.com", "somepassword")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], error)

        response = self.login_user("test@example.com", "somepassword")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], error)

        response = self.login_user("someemail@example.com", "testpassword")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], error)

class VerifyMFA(TestCase):
    def test(self):
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        email = "test@example.com"
        password = "testpassword"
        user =  User.objects.create_user(email = email, password = password)
        user.mfa.setup()
        user.mfa.enable()

        response = self.login_user(email, password)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.cookies), 0)
        token = response.json()["token"]
        self.assertEqual(type(token), str)
        try:
            uuid.UUID(token, version = 4)
        except ValueError:
            raise ValueError("Invalid token when logging in user with MFA enabled.")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/verify-mfa/", {"token": token, "code": generate_code(user.mfa.secret)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.cookies), 2)

        access_token = dict(response.cookies["access_token"].items())
        self.assertTrue(access_token["httponly"])
        self.assertEqual(access_token["samesite"], "Lax")

        refresh_token = dict(response.cookies["refresh_token"].items())
        self.assertTrue(refresh_token["httponly"])
        self.assertEqual(refresh_token["samesite"], "Lax")

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

class Logout(TestCase):
    def test(self):
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 401)

        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.cookies.items()), 2)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        self.assertNotEqual(response.cookies["access_token"].value, "")
        self.assertNotEqual(response.cookies["refresh_token"].value, "")
        self.assertEqual(str(response.cookies["access_token"]).split("; ")[1], "HttpOnly")
        self.assertEqual(str(response.cookies["refresh_token"]).split("; ")[1], "HttpOnly")

        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.cookies.items()), 2)
        self.assertEqual(response.cookies["access_token"].value, "")
        self.assertEqual(response.cookies["refresh_token"].value, "")

    def test_without_being_authenticated(self):
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication credentials were not provided.")

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
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "'refresh_token' field must be provided."})

    def test_with_invalid_cookie(self):
        self.client.cookies["refresh_token"] = "not-a-real-token"

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "Invalid refresh token."})

    def test_with_blacklisted_cookie(self):
        refresh = RefreshToken.for_user(create_user())
        refresh.blacklist()
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "Invalid refresh token."})

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
            self.assertEqual(response.json(), {"error": "Invalid refresh token."})

    def test_with_tampered_cookie(self):
        refresh = RefreshToken.for_user(create_user())

        original = str(refresh)
        tampered = original[:-1] + ("A" if original[-1] != "A" else "B")

        self.client.cookies["refresh"] = tampered

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access_token", self.client.cookies)
        self.assertNotIn("refresh_token", self.client.cookies)
        self.assertEqual(len(response.cookies.items()), 0)

    def test_with_login(self):
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
        self.assertIn("refresh_token", response.cookies)

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
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)

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
            _, response = self.create_and_login_user()
            self.assertEqual(response.status_code, 200)
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
        user, _ = self.create_and_login_user()
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
            }
        }

        self.assertEqual(response.json(), expected_json)

    def test_patch(self):
        user, _ = self.create_and_login_user()
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
            }
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

        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)

        self.assertIn("access_token", self.client.cookies)

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "test@example.com")

class SetupMFA(TestCase):
    def test(self):
        user, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
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

class EnableMFA(TestCase):
    def test(self):
        user, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)

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

    def test_requires_valid_code(self):
        user, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)

        user.mfa.setup()

        def assert_response(response: HttpResponse):
            self.assertEqual(response.status_code, 403)
            self.assertEqual(len(response.json()), 1)
            self.assertEqual(response.json()["error"], "mfa.messages.errorInvalidCode")

        assert_response(self.client.post("/api/enable-mfa/"))
        assert_response(self.client.post("/api/enable-mfa/", {"code": "invalid-code"}))
        assert_response(self.client.post("/api/enable-mfa/", {"code": "1"}))
        assert_response(self.client.post("/api/enable-mfa/", {"code": "12345"}))
        assert_response(self.client.post("/api/enable-mfa/", {"code": "1234567"}))

class DisableMFA(TestCase):
    def test(self):
        user, response = self.create_and_login_user()
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

class DeleteAccount(TestCase):
   def test(self):
        response = self.client.delete("/api/delete-account/")
        self.assertEqual(response.status_code, 401)

        create_user()
        response = self.client.delete("/api/delete-account/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.delete("/api/delete-account/", {"password": "testpassword"}, "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(User.objects.count(), 0)

        create_user()
        user = create_user("someone@example.com", "somepassword")

        self.login_user("test@example.com", "testpassword")
        response = self.client.delete("/api/delete-account/", {"password": "testpassword"}, "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user)

class GetChat(TestCase):
    def test(self):
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "'chat_uuid' field must be provided."})

        chat1 = Chat.objects.create(user = user1, title = "Greetings")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat1.uuid), "title": "Greetings", "pending_message_id": None, "is_archived": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat2 = Chat.objects.create(user = user1, title = "Math Question")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat2.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat2.uuid),"title": "Math Question", "pending_message_id": None, "is_archived": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat3 = Chat.objects.create(user = user1, title = "Weather Inquiry", is_archived = True)
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat3.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat3.uuid),"title": "Weather Inquiry", "pending_message_id": None, "is_archived": True, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat4 = Chat.objects.create(user = user1, title = "Joke Request")
        chat4.pending_message = Message.objects.create(chat = chat4, text = "Tell me a joke.", is_from_user = True)
        chat4.save()
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat4.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat4.uuid),"title": "Joke Request", "pending_message_id": 1, "is_archived": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat1.uuid), "title": "Greetings", "pending_message_id": None, "is_archived": False, "index": 3}
        self.assertEqual(response.json(), expected_json)

        self.logout_user()
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 401)

        user2 = create_user("someone@example.com", "somepassword")
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 401)

        self.login_user("someone@example.com", "somepassword")
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "'chat_uuid' field must be provided."})

        chat5 = Chat.objects.create(user = user2, title = "Travel Advice")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat5.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat5.uuid), "title": "Travel Advice", "pending_message_id": None, "is_archived": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Chat was not found."})

class GetChats(TestCase):
    def test(self):
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat1 = Chat.objects.create(user = user1, title = "Test chat 1")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [{"uuid": str(chat1.uuid), "title": chat1.title, "pending_message_id": None, "is_archived": False, "index": 0}]
        self.assertEqual(response.json()["chats"], expected_chats)

        chat2 = Chat.objects.create(user = user1, title = "Test chat 2")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat2.uuid), "title": chat2.title, "pending_message_id": None, "is_archived": False, "index": 0},
            {"uuid": str(chat1.uuid), "title": chat1.title, "pending_message_id": None, "is_archived": False, "index": 1}
        ]
        self.assertEqual(response.json()["chats"], expected_chats)

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat3 = Chat.objects.create(user = user2, title = "Test chat 3")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [{"uuid": str(chat3.uuid), "title": chat3.title, "pending_message_id": None, "is_archived": False, "index": 0}]
        self.assertEqual(response.json()["chats"], expected_chats)

        chat4 = Chat.objects.create(user = user2, title = "Test chat 4")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat4.uuid), "title": chat4.title, "pending_message_id": None, "is_archived": False, "index": 0},
            {"uuid": str(chat3.uuid), "title": chat3.title, "pending_message_id": None, "is_archived": False, "index": 1}
        ]
        self.assertEqual(response.json()["chats"], expected_chats)

class SearchChats(TestCase):
    def test(self):
        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 401)

        response = self.client.get("/api/search-chats/?search=What is math")
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entries"], [])

        chat = Chat.objects.create(user = user, title = "A question about math")

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entries"], [])

        response = self.client.get("/api/search-chats/?search=A question about math")
        self.assertEqual(response.status_code, 200)

        expected_etries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": [],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json()["entries"], expected_etries)

        Message.objects.create(chat = chat, text = "What is math?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Math is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)

        expected_etries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": ["What is math?"],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json()["entries"], expected_etries)

        response = self.client.get("/api/search-chats/?search=math")
        self.assertEqual(response.status_code, 200)

        expected_etries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": ["What is math?", "Math is..."],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json()["entries"], expected_etries)

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entries"], [])

        chat = Chat.objects.create(user = user, title = "Geometry question")

        response = self.client.get("/api/search-chats/?search=Question about geometry")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["entries"], [])

        response = self.client.get("/api/search-chats/?search=Geometry question")
        self.assertEqual(response.status_code, 200)

        expected_etries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": [],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json()["entries"], expected_etries)

        Message.objects.create(chat = chat, text = "What is geometry?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Geometry is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)

        expected_etries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": ["What is geometry?"],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json()["entries"], expected_etries)

        response = self.client.get("/api/search-chats/?search=geometry")
        self.assertEqual(response.status_code, 200)

        expected_etries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": ["What is geometry?", "Geometry is..."],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json()["entries"], expected_etries)

class RenameChat(TestCase):
    def test(self):
        response = self.client.patch("/api/rename-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.patch("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"}, content_type = "application/json")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"}, content_type = "application/json")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"}, content_type = "application/json")
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Test title")
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"}, content_type = "application/json")
        self.assertEqual(response.status_code, 400)

        response = self.client.patch("/api/rename-chat/", {"chat_uuid": chat1.uuid, "new_title": "Some title"}, content_type = "application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.first().title, "Some title")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat2 = Chat.objects.create(user = user2, title = "Some chat")
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": chat2.uuid, "new_title": "Some other chat"}, content_type = "application/json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Some title", [Chat.objects.first().title, Chat.objects.last().title])
        self.assertIn("Some other chat", [Chat.objects.first().title, Chat.objects.last().title])

class ArchiveChat(TestCase):
    def test(self):
        content_type = "application/json"

        response = self.client.patch("/api/archive-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.patch("/api/archive-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.patch("/api/archive-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.patch("/api/archive-chat/", {"chat_uuid": "test-uuid"}, content_type)
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Greetings")
        chat2 = Chat.objects.create(user = user1, title = "Math Help")
        self.assertFalse(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

        response = self.client.patch("/api/archive-chat/", {"chat_uuid": chat1.uuid}, content_type)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        chat1 = Chat.objects.get(user = user1, title = "Greetings")
        chat2 = Chat.objects.get(user = user1, title = "Math Help")
        self.assertTrue(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

        self.logout_user()

        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = Chat.objects.create(user = user2, title = "Travel Advice")
        self.assertFalse(chat3.is_archived)

        response = self.client.patch("/api/archive-chat/", {"chat_uuid": chat3.uuid}, content_type)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        chat3 = Chat.objects.get(user = user2, title = "Travel Advice")
        self.assertTrue(chat3.is_archived)

        chat1 = Chat.objects.get(user = user1, title = "Greetings")
        chat2 = Chat.objects.get(user = user1, title = "Math Help")
        self.assertTrue(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

class UnarchiveChat(TestCase):
    def test(self):
        content_type = "application/json"

        response = self.client.patch("/api/unarchive-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": "test-uuid"}, content_type)
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Greetings", is_archived = True)
        chat2 = Chat.objects.create(user = user1, title = "Math Help", is_archived = True)
        self.assertTrue(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": chat1.uuid}, content_type)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        chat1 = Chat.objects.get(user = user1, title = "Greetings")
        chat2 = Chat.objects.get(user = user1, title = "Math Help")
        self.assertFalse(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

        self.logout_user()

        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = Chat.objects.create(user = user2, title = "Travel Advice", is_archived = True)
        self.assertTrue(chat3.is_archived)

        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": chat3.uuid}, content_type)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

        chat3 = Chat.objects.get(user = user2, title = "Travel Advice")
        self.assertFalse(chat3.is_archived)

        chat1 = Chat.objects.get(user = user1, title = "Greetings")
        chat2 = Chat.objects.get(user = user1, title = "Math Help")
        self.assertFalse(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

class DeleteChat(TestCase):
    def test(self):
        response = self.client.delete("/api/delete-chat/", content_type = "application/json")
        self.assertEqual(response.status_code, 401)

        response = self.client.delete("/api/delete-chat/", {"chat_uuid": "test-uuid"}, content_type = "application/json")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": "test-uuid"}, content_type = "application/json")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": "test-uuid"}, content_type = "application/json")
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Test chat 1")

        response = self.client.delete("/api/delete-chat/", {"chat_uuid": "test-uuid"}, content_type = "application/json")
        self.assertEqual(response.status_code, 400)

        response = self.client.delete("/api/delete-chat/", {"chat_uuid": chat1.uuid}, content_type = "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 2")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = Chat.objects.create(user = user2, title = "Test chat 3")
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": chat3.uuid}, content_type = "application/json")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Chat.objects.first().user, user1)

class ArchiveChats(TestCase):
    def test(self):
        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
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

        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")

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
        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
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

        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")

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
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
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
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        Chat.objects.create(user = user2, title = "Test chat 6")
        Chat.objects.create(user = user2, title = "Test chat 7")
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 2)
        self.assertEqual(Chat.objects.first().user, user1)
        self.assertEqual(Chat.objects.last().user, user1)

class StopPendingChats(TestCase):
    def test(self):
        response = self.client.patch("/api/stop-pending-chats/")
        self.assertEqual(response.status_code, 401)

        user1, _ = self.create_and_login_user()

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

        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
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
        response = self.client.get("/api/get-message-file-content/")
        self.assertEqual(response.status_code, 401)

        user = create_user()
        response = self.client.get("/api/get-message-file-content/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.get("/api/get-message-file-content/")
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user, title = "File Analysis")
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

class GetMessages(TestCase):
    def test(self):
        response = self.client.get("/api/get-messages/")
        self.assertEqual(response.status_code, 401)

        response = self.client.get("/api/get-messages/?chat_uuid=849087f8-4b3f-47f1-980d-5a5a3d325912")
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
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
            {"id": user_message_1.id, "text": "Hello!", "is_from_user": True, "files": [], "model": None},
            {"id": bot_message_1.id, "text": "Hi!", "is_from_user": False, "files": [], "model": None}
        ]
        self.assertEqual(response.json(), expected_messages)

        user_message_2 = Message.objects.create(chat = chat, text = "Hello again!", is_from_user = True)
        bot_message_2 = Message.objects.create(chat = chat, text = "Hi again!", is_from_user = False)

        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"id": user_message_1.id, "text": "Hello!", "is_from_user": True, "files": [], "model": None},
            {"id": bot_message_1.id, "text": "Hi!", "is_from_user": False, "files": [], "model": None},
            {"id": user_message_2.id, "text": "Hello again!", "is_from_user": True, "files": [], "model": None},
            {"id": bot_message_2.id, "text": "Hi again!", "is_from_user": False, "files": [], "model": None}
        ]
        self.assertEqual(response.json(), expected_messages)

class NewMessage(TestCase):
    @patch("chat.views.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)

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

    def test_requires_authentication(self):
        response = self.client.post("/api/new-message/")
        self.assertEqual(response.status_code, 401)

    @patch("chat.views.is_any_user_chat_pending", return_value = True)
    def test_cannot_post_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "A chat is already pending."})

    @patch("chat.views.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.generate_pending_message_in_chat")
    def test_empty_chat_uuid_creates_new_chat(self, mock_task, _):
        self.create_and_login_user()

        response = self.client.post("/api/new-message/", {"chat_uuid": "", "text": "Hello!"}, format = "multipart")
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
        user, _ = self.create_and_login_user()
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
        self.assertEqual(response.json(), {"error": "Chat was not found."})