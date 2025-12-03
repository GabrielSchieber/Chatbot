from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.test import TestCase

from .utils import create_user
from .. import models

class User(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")
        self.assertTrue(check_password("testpassword", user.password))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertHasAttr(user, "chats")
        self.assertHasAttr(user, "mfa")
        self.assertHasAttr(user, "preferences")

    def test_authentication(self):
        create_user()
        user = authenticate(email = "test@example.com", password = "testpassword")
        self.assertEqual(type(user), models.User)
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")

class Chat(TestCase):
    def test_creation(self):
        user = create_user()
        chat = models.Chat.objects.create(user = user, title = "Test chat")
        self.assertEqual(chat.user, user)
        self.assertEqual(chat.title, "Test chat")
        self.assertIsNone(chat.pending_message)

class Message(TestCase):
    def test_creation(self):
        user = create_user()
        chat = models.Chat.objects.create(user = user, title = "Test chat")
        user_message = models.Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        bot_message = models.Message.objects.create(chat = chat, text = "Hi!", is_from_user = False)
        self.assertEqual(user_message.chat, chat)
        self.assertEqual(bot_message.chat, chat)
        self.assertEqual(user_message.text, "Hello!")
        self.assertEqual(bot_message.text, "Hi!")
        self.assertTrue(user_message.is_from_user)
        self.assertFalse(bot_message.is_from_user)