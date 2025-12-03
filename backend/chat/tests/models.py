from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

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

class UserPreferences(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.preferences.theme, "System")
        self.assertTrue(user.preferences.has_sidebar_open)
        for a in ["language", "custom_instructions", "nickname", "occupation", "about"]:
            self.assertEqual(getattr(user.preferences, a), "")

class UserMFA(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_setup(self):
        user = create_user()
        secret, auth_url = user.mfa.setup()
        self.assertNotEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)
        self.assertNotEqual(secret, user.mfa.secret)
        self.assertEqual(auth_url, f"otpauth://totp/Chatbot:test%40example.com?secret={secret}&issuer=Chatbot")

    def test_enable(self):
        user = create_user()
        backup_codes = user.mfa.enable()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(len(user.mfa.backup_codes), 10)
        self.assertTrue(user.mfa.is_enabled)
        self.assertEqual(len(backup_codes), 10)
        for backup_code, hashed_backup_code in zip(backup_codes, user.mfa.backup_codes):
            self.assertNotEqual(backup_code, hashed_backup_code)
            self.assertEqual(len(backup_code), 12)
            self.assertEqual(len(hashed_backup_code), 89)
            self.assertEqual(type(backup_code), str)
            self.assertEqual(type(hashed_backup_code), str)

    def test_disable(self):
        user = create_user()
        user.mfa.setup()
        user.mfa.enable()
        user.mfa.disable()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

class PreAuthToken(TestCase):
    def test_is_expired(self):
        user = create_user()

        time_to_freeze = timezone.datetime(2025, 1, 1, 12)
        with freeze_time(time_to_freeze):
            pre_auth_token = models.PreAuthToken.objects.create(user = user)
            self.assertFalse(pre_auth_token.is_expired())

        with freeze_time(time_to_freeze + timedelta(minutes = 4, seconds = 59)):
            self.assertFalse(pre_auth_token.is_expired())

        with freeze_time(time_to_freeze + timedelta(minutes = 5, seconds = 1)):
            self.assertTrue(pre_auth_token.is_expired())

class Chat(TestCase):
    def test_creation(self):
        user = create_user()
        chat = models.Chat.objects.create(user = user, title = "Test chat")
        self.assertEqual(chat.user, user)
        self.assertEqual(chat.title, "Test chat")
        self.assertIsNone(chat.pending_message)
        self.assertHasAttr(chat, "messages")
        self.assertEqual(chat.messages.count(), 0)
        self.assertEqual(chat.last_modified_at(), chat.created_at)

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