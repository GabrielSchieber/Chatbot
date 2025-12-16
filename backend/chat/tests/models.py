from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from .utils import create_user
from .. import models
from ..totp_utils import generate_code, generate_secret

class User(TestCase):
    def test_creation(self):
        def test(email: str, is_staff: bool, is_superuser: bool, user: models.User | None = None):
            if user is None:
                initial_count = models.User.objects.count()
                user = models.User.objects.create_user(email, "testpassword", is_staff, is_superuser)
            else:
                initial_count = None

            self.assertEqual(user.email, email)
            self.assertNotEqual(user.password, "testpassword")
            self.assertTrue(check_password("testpassword", user.password))
            self.assertTrue(user.is_active)
            self.assertEqual(user.is_staff, is_staff)
            self.assertEqual(user.is_superuser, is_superuser)

            self.assertHasAttr(user, "chats")
            self.assertHasAttr(user, "mfa")
            self.assertHasAttr(user, "preferences")

            if initial_count is not None:
                self.assertEqual(models.User.objects.count(), initial_count + 1)

        test("test1@example.com", False, False)
        test("test2@example.com", True, False)
        test("test3@example.com", False, True)
        test("test4@example.com", True, True)
        test("test5@example.com", True, True, models.User.objects.create_superuser("test5@example.com", "testpassword"))
        self.assertEqual(models.User.objects.count(), 5)

    def test_authentication(self):
        create_user()
        user = authenticate(email = "test@example.com", password = "testpassword")
        self.assertEqual(type(user), models.User)
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")

    def test_invalid_email(self):
        def test(email: str):
            with self.assertRaises(ValueError) as cm:
                create_user(email)
            self.assertEqual(str(cm.exception), "Email address is invalid.")

        test("test")
        test("example.com")
        test("test@example")
        test("@example")
        test("test@")
        test("test@.com")
        test("@.com")
        self.assertEqual(models.User.objects.count(), 0)

    def test_invalid_password(self):
        def test(password: str):
            with self.assertRaises(ValueError) as cm:
                create_user(password = password)
            self.assertEqual(str(cm.exception), "Password must have between 12 and 1000 characters.")

        test("")
        test("test")
        test("onepassword")
        test("".join(["password123" for _ in range(91)]))
        self.assertEqual(models.User.objects.count(), 0)

    def test_existing_email(self):
        create_user()
        self.assertEqual(models.User.objects.count(), 1)

        with self.assertRaises(ValueError) as cm:
            create_user()
        self.assertEqual(str(cm.exception), "Email is already registered.")

        self.assertEqual(models.User.objects.count(), 1)

class UserPreferences(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.preferences.theme, "System")
        self.assertTrue(user.preferences.has_sidebar_open)
        for a in ["language", "custom_instructions", "nickname", "occupation", "about"]:
            self.assertEqual(getattr(user.preferences, a), "")

    def test_valid_languages(self):
        user = create_user()
        for l in ["", "English", "Português"]:
            user.preferences.delete()
            models.UserPreferences.objects.create(user = user, language = l)
            self.assertEqual(models.UserPreferences.objects.first().language, l)

    def test_invalid_languages(self):
        user = create_user()
        user.preferences.delete()
        for l in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError, msg = {'language': [f"Value '{l}' is not a valid choice."]}):
                models.UserPreferences.objects.create(user = user, language = l)
            self.assertEqual(models.UserPreferences.objects.count(), 0)

    def test_valid_theme(self):
        user = create_user()
        for t in ["System", "Light", "Dark"]:
            user.preferences.delete()
            models.UserPreferences.objects.create(user = user, theme = t)
            self.assertEqual(models.UserPreferences.objects.first().theme, t)

class UserMFA(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertEqual(user.mfa.secret, b"")
        self.assertEqual(user.mfa.backup_codes, [])
        self.assertFalse(user.mfa.is_enabled)

    def test_verify(self):
        user = create_user()

        [self.assertFalse(user.mfa.verify(v)) for v in [None, False, True, 0, 1, (), [], {}]]

        user.mfa.setup()
        backup_codes = user.mfa.enable()
    
        self.assertFalse(user.mfa.verify(generate_code(generate_secret()[1])))
        self.assertTrue(user.mfa.verify(generate_code(user.mfa.secret)))

        for backup_code in backup_codes:
            self.assertTrue(user.mfa.verify(backup_code))
            self.assertFalse(user.mfa.verify(backup_code))

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

class UserSession(TestCase):
    def test_creation(self):
        user = create_user()
        self.assertHasAttr(user, "sessions")

        user.sessions.create()
        self.assertEqual(user.sessions.count(), 1)

        session = user.sessions.first()
        self.assertEqual(session.user, user)
        self.assertHasAttr(session, "uuid")

        self.assertIsNotNone(session.login_at)
        self.assertIsNone(session.logout_at)

        self.assertIsNone(session.ip_address)

        for a in ["user_agent", "device", "browser", "os", "refresh_jti"]:
            self.assertEqual(getattr(session, a), "")

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
        self.assertFalse(chat.is_archived)
        self.assertFalse(chat.is_temporary)
        self.assertEqual(chat.messages.count(), 0)
        self.assertEqual(chat.last_modified_at(), chat.created_at)

    def test_last_modified_at(self):
        user = create_user()

        time_to_freeze = timezone.datetime(2025, 1, 1, 12)
        with freeze_time(time_to_freeze):
            chat = models.Chat.objects.create(user = user, title = "Test chat")
            self.assertEqual(chat.last_modified_at(), chat.created_at)

        with freeze_time(time_to_freeze + timedelta(minutes = 5)):
            user_message = models.Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
            self.assertEqual(chat.last_modified_at(), user_message.last_modified_at)
            self.assertEqual(chat.last_modified_at(), user_message.created_at)

        with freeze_time(time_to_freeze + timedelta(minutes = 10)):
            bot_message = models.Message.objects.create(chat = chat, text = "Hello! How are you?", is_from_user = False)
            self.assertEqual(chat.last_modified_at(), bot_message.last_modified_at)
            self.assertEqual(chat.last_modified_at(), bot_message.created_at)

        with freeze_time(time_to_freeze + timedelta(minutes = 15)):
            user_message.text = "Hi!"
            user_message.save()
            self.assertEqual(chat.last_modified_at(), user_message.last_modified_at)
            self.assertNotEqual(chat.last_modified_at(), user_message.created_at)

        with freeze_time(time_to_freeze + timedelta(minutes = 20)):
            bot_message.text = "Hi! How are you?"
            bot_message.save()
            self.assertEqual(chat.last_modified_at(), bot_message.last_modified_at)
            self.assertNotEqual(chat.last_modified_at(), bot_message.created_at)

class Message(TestCase):
    def test_creation(self):
        user = create_user()
        chat = models.Chat.objects.create(user = user, title = "Test chat")
        user_message = models.Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        bot_message = models.Message.objects.create(chat = chat, text = "Hi!", is_from_user = False, model = "SmolLM2-135M")
        self.assertEqual(user_message.chat, chat)
        self.assertEqual(bot_message.chat, chat)
        self.assertEqual(user_message.text, "Hello!")
        self.assertEqual(bot_message.text, "Hi!")
        self.assertTrue(user_message.is_from_user)
        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(user_message.model, "")
        self.assertEqual(bot_message.model, "SmolLM2-135M")
        self.assertHasAttr(user_message, "files")
        self.assertHasAttr(bot_message, "files")
        self.assertEqual(user_message.files.count(), 0)
        self.assertEqual(bot_message.files.count(), 0)

    def test_valid_models(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        for m in ["", "SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]:
            chat.messages.create(text = "Hi!", is_from_user = False, model = m)
        self.assertEqual(models.Message.objects.count(), 5)

    def test_invalid_models(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        for m in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError, msg = {'model': [f"Value '{m}' is not a valid choice."]}):
                chat.messages.create(text = "Hi!", is_from_user = False, model = m)
        self.assertEqual(models.Message.objects.count(), 0)

    def test_invalid_models_with_bulk_create(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        with self.assertRaises(ValidationError, msg = {'model': [f"Value 'invalid' is not a valid choice."]}):
            chat.messages.bulk_create([
                models.Message(chat = chat, text = "Hello!", is_from_user = False, model = invalid_model)
                for invalid_model in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]
            ])
        self.assertEqual(models.Message.objects.count(), 0)

class MessageFile(TestCase):
    def test_creation(self):
        user = create_user()
        chat = models.Chat.objects.create(user = user, title = "Test chat")
        message = models.Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        message_file = models.MessageFile.objects.create(
            message = message,
            name = "document.txt",
            content = "This is a document about...".encode(),
            content_type = "text/plain"
        )
        self.assertEqual(message_file.message, message)
        self.assertEqual(message_file.name, "document.txt")
        self.assertEqual(message_file.content, "This is a document about...".encode())
        self.assertEqual(message_file.content_type, "text/plain")