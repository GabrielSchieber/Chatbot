from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.test import TestCase

from chat.models import Chat, Message, User

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
        self.assertTrue(chat.is_complete)

class MessageTests(TestCase):
    def test_creation(self):
        user = create_user()
        chat = Chat.objects.create(user = user, title = "Test chat")
        user_message = Message.objects.create(chat = chat, text = "Hello!", is_user_message = True)
        bot_message = Message.objects.create(chat = chat, text = "Hi!", is_user_message = False)
        self.assertEqual(user_message.chat, chat)
        self.assertEqual(bot_message.chat, chat)
        self.assertEqual(user_message.text, "Hello!")
        self.assertEqual(bot_message.text, "Hi!")
        self.assertTrue(user_message.is_user_message)
        self.assertFalse(bot_message.is_user_message)

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

    def test_login(self):
        _, response = self.create_and_login_user()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

    def test_login_with_invalid_credentials(self):
        create_user()
        response = self.login_user("someemail@example.com", "somepassword")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid credentials")

        response = self.login_user("test@example.com", "somepassword")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid credentials")

        response = self.login_user("someemail@example.com", "testpassword")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Invalid credentials")

    def test_logout(self):
        self.create_and_login_user()
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

    def test_logout_without_being_authenticated(self):
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication credentials were not provided.")

    def test_me(self):
        user, _ = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], user.id)
        self.assertEqual(response.json()["email"], user.email)

    def login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        return self.client.post("/api/login/", {"email": email, "password": password})

    def create_and_login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        user = create_user(email, password)
        response = self.client.post("/api/login/", {"email": email, "password": password})
        return user, response

def create_user(email: str = "test@example.com", password: str = "testpassword") -> User:
    return User.objects.create_user(email = email, password = password)