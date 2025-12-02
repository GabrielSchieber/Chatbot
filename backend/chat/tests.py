import uuid
from datetime import datetime, timedelta, timezone as dt_timezone

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.test import TestCase
from freezegun import freeze_time
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Chat, Message, User
from .totp_utils import generate_code

class UserTests(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_authentication(self):
        create_user()
        user = authenticate(email = "test@example.com", password = "testpassword")
        self.assertEqual(type(user), User)
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.email, "testpassword")

class ChatTests(TestCase):
    def test_creation(self):
        user = create_user()
        chat = Chat.objects.create(user = user, title = "Test chat")
        self.assertEqual(chat.user, user)
        self.assertEqual(chat.title, "Test chat")
        self.assertIsNone(chat.pending_message)

class MessageTests(TestCase):
    def test_creation(self):
        user = create_user()
        chat = Chat.objects.create(user = user, title = "Test chat")
        user_message = Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        bot_message = Message.objects.create(chat = chat, text = "Hi!", is_from_user = False)
        self.assertEqual(user_message.chat, chat)
        self.assertEqual(bot_message.chat, chat)
        self.assertEqual(user_message.text, "Hello!")
        self.assertEqual(bot_message.text, "Hi!")
        self.assertTrue(user_message.is_from_user)
        self.assertFalse(bot_message.is_from_user)

class ViewTests(TestCase):
    def test_signup(self):
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.all().count(), 1)
        user = User.objects.first()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)

    def test_signup_with_existing_email(self):
        create_user()
        response = self.client.post("/api/signup/", {"email": "test@example.com", "password": "testpassword"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.all().count(), 1)

    def test_signup_with_invalid_email(self):
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

    def test_signup_with_invalid_password(self):
        def test(password: str):
            response = self.client.post("/api/signup/", {"email": "test@example.com", "password": password})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["error"], "Password must have between 12 and 1000 characters.")
            self.assertEqual(User.objects.all().count(), 0)

        test("")
        test("test")
        test("onepassword")
        test("".join(["password123" for _ in range(91)]))

    def test_login(self):
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)

    def test_login_with_invalid_credentials(self):
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

    def test_verify_mfa(self):
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

    def test_logout(self):
        self.create_and_login_user()
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 200)

    def test_logout_without_being_authenticated(self):
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication credentials were not provided.")

    def test_refresh(self):
        refresh = RefreshToken.for_user(create_user())
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

        self.assertNotEqual(response.cookies["refresh_token"].value, str(refresh))

    def test_refresh_without_cookie(self):
        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "'refresh_token' field must be provided."})

    def test_refresh_with_invalid_cookie(self):
        self.client.cookies["refresh_token"] = "not-a-real-token"

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "Invalid refresh token."})

    def test_refresh_with_blacklisted_cookie(self):
        refresh = RefreshToken.for_user(create_user())
        refresh.blacklist()
        self.client.cookies["refresh_token"] = str(refresh)

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "Invalid refresh token."})

    def test_refresh_with_expired_cookie(self):
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

    def test_refresh_with_login(self):
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
        self.assertIn("refresh_token", response.cookies)

        self.client.cookies = response.cookies

        response = self.client.post("/api/refresh/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)

    def test_me(self):
        user, _ = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], user.email)

    def test_me_with_expired_cookie(self):
        refresh = RefreshToken.for_user(create_user())
        self.client.cookies["access_token"] = str(refresh.access_token)

        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)

        exp_timestamp = refresh.access_token["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp, dt_timezone.utc)

        with freeze_time(exp_datetime + timedelta(seconds = 1)):
            response = self.client.get("/api/me/")
            self.assertEqual(response.status_code, 401)

    def test_get_messages(self):
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

    def test_get_chats(self):
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

    def test_search_chats(self):
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

    def test_rename_chat(self):
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

    def test_delete_chat(self):
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

    def test_delete_chats(self):
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

    def test_delete_account(self):
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

    def login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        return self.client.post("/api/login/", {"email": email, "password": password})

    def logout_user(self):
        return self.client.post("/api/logout/")

    def create_and_login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        user = create_user(email, password)
        response = self.login_user(email, password)
        return user, response

def create_user(email: str = "test@example.com", password: str = "testpassword") -> User:
    return User.objects.create_user(email = email, password = password)