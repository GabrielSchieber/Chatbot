from django.contrib.auth import authenticate
from django.test import TestCase

from chat.models import Chat, Message, User

class UserTests(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
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

def create_user(email: str = "test@example.com", password: str = "testpassword") -> User:
    return User.objects.create_user(email = email, password = password)