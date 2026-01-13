from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from .utils import create_user
from .. import models

class User(TestCase):
    def test_creation(self):
        def test(
            email: str,
            has_verified_email: bool,
            is_active: bool,
            is_guest: bool,
            is_staff: bool,
            is_superuser: bool,
            user: models.User | None = None
        ):
            if user is None:
                initial_count = models.User.objects.count()
                user = models.User.objects.create_user(email, "testpassword", has_verified_email, is_active, is_guest)
            else:
                initial_count = None

            self.assertEqual(user.email, email)
            self.assertNotEqual(user.password, "testpassword")
            self.assertTrue(check_password("testpassword", user.password))
            self.assertEqual(user.has_verified_email, has_verified_email)
            self.assertEqual(user.is_active, is_active)
            self.assertEqual(user.is_guest, is_guest)
            self.assertEqual(user.is_staff, is_staff)
            self.assertEqual(user.is_superuser, is_superuser)

            for name in ["mfa", "preferences", "sessions", "email_verification_tokens", "pre_auth_tokens", "password_reset_tokens", "chats"]:
                self.assertHasAttr(user, name)

            if initial_count is not None:
                self.assertEqual(models.User.objects.count(), initial_count + 1)

        for i, [has_verified_email, is_active, is_guest] in enumerate([
            [False, False, False],
            [True, False, False],
            [False, True, False],
            [True, True, False],
            [False, False, True],
            [True, False, True],
            [False, True, True],
            [True, True, True]
        ], 1):
            test(f"test{i}@example.com", has_verified_email, is_active, is_guest, False, False)

        test(
            "test@example.com",
            True,
            True,
            False,
            True,
            True,
            models.User.objects.create_superuser("test@example.com", "testpassword")
        )

        self.assertEqual(models.User.objects.count(), 9)

    def test_authentication(self):
        create_user()
        user = authenticate(email = "test@example.com", password = "testpassword")
        self.assertEqual(type(user), models.User)
        self.assertEqual(user.email, "test@example.com")
        self.assertNotEqual(user.password, "testpassword")

    def test_invalid_email(self):
        def test(email: str):
            with self.assertRaises(ValidationError) as cm:
                create_user(email)
            self.assertEqual(cm.exception.message_dict, {"email": ["Enter a valid email address."]})

        test("test")
        test("example.com")
        test("test@example")
        test("@example")
        test("test@")
        test("test@.com")
        test("@.com")
        self.assertEqual(models.User.objects.count(), 0)

    def test_invalid_password(self):
        def test(password, type_tried: str):
            with self.assertRaises(TypeError) as cm:
                create_user(password = password)
            self.assertEqual(str(cm.exception), f"Password must be a string or bytes, got {type_tried}.")

        test(0, "int")
        test(-5.25, "float")
        test(False, "bool")
        test({}, "dict")
        test([], "list")
        test((), "tuple")
        self.assertEqual(models.User.objects.count(), 0)

    def test_existing_email(self):
        create_user()
        self.assertEqual(models.User.objects.count(), 1)

        with self.assertRaises(ValidationError) as cm:
            create_user()
        self.assertEqual(cm.exception.message_dict, {"email": ["User with this Email already exists."]})

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
            with self.assertRaises(ValidationError) as cm:
                models.UserPreferences.objects.create(user = user, language = l)
            self.assertEqual(dict(cm.exception), {"language": [f"Value '{l}' is not a valid choice."]})
            self.assertEqual(models.UserPreferences.objects.count(), 0)

    def test_invalid_languages_with_bulk_create(self):
        users = [create_user(f"test{i + 1}@example.com") for i in range(5)]
        for u in users:
            u.preferences.delete()
        for l in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError) as cm:
                models.UserPreferences.objects.bulk_create([models.UserPreferences(user = u, language = l) for u in users])
            self.assertEqual(dict(cm.exception), {"language": [f"Value '{l}' is not a valid choice."]})
            self.assertEqual(models.UserPreferences.objects.count(), 0)

    def test_invalid_languages_with_bulk_update(self):
        users = [create_user(f"test{i + 1}@example.com") for i in range(5)]

        for l in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError) as cm:
                preferences = [u.preferences for u in users]
                for p in preferences:
                    p.language = l
                models.UserPreferences.objects.bulk_update(preferences, "language")

            self.assertEqual(dict(cm.exception), {"language": [f"Value '{l}' is not a valid choice."]})

        self.assertEqual(models.UserPreferences.objects.count(), 5)
        for p in models.UserPreferences.objects.all():
            self.assertEqual(p.language, "")

    def test_valid_theme(self):
        user = create_user()
        for t in ["System", "Light", "Dark"]:
            user.preferences.delete()
            models.UserPreferences.objects.create(user = user, theme = t)
            self.assertEqual(models.UserPreferences.objects.first().theme, t)

    def test_invalid_theme(self):
        user = create_user()
        user.preferences.delete()
        for t in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError) as cm:
                models.UserPreferences.objects.create(user = user, theme = t)
            self.assertEqual(dict(cm.exception), {"theme": [f"Value '{t}' is not a valid choice."]})
            self.assertEqual(models.UserPreferences.objects.count(), 0)

    def test_invalid_themes_with_bulk_create(self):
        users = [create_user(f"test{i + 1}@example.com") for i in range(5)]
        for u in users:
            u.preferences.delete()
        for t in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError) as cm:
                models.UserPreferences.objects.bulk_create([models.UserPreferences(user = u, theme = t) for u in users])
            self.assertEqual(dict(cm.exception), {"theme": [f"Value '{t}' is not a valid choice."]})
            self.assertEqual(models.UserPreferences.objects.count(), 0)

    def test_invalid_themes_with_bulk_update(self):
        users = [create_user(f"test{i + 1}@example.com") for i in range(5)]

        for t in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError) as cm:
                preferences = [u.preferences for u in users]
                for p in preferences:
                    p.theme = t
                models.UserPreferences.objects.bulk_update(preferences, "theme")

            self.assertEqual(dict(cm.exception), {"theme": [f"Value '{t}' is not a valid choice."]})

        self.assertEqual(models.UserPreferences.objects.count(), 5)
        for p in models.UserPreferences.objects.all():
            self.assertEqual(p.theme, "System")

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
    
        self.assertFalse(user.mfa.verify(models.UserMFA.generate_code(models.UserMFA.generate_secret()[1])))
        self.assertTrue(user.mfa.verify(models.UserMFA.generate_code(user.mfa.secret)))

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

class Chat(TestCase):
    def test_creation(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
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
            chat = user.chats.create(title = "Test chat")
            self.assertEqual(chat.last_modified_at(), chat.created_at)

        with freeze_time(time_to_freeze + timedelta(minutes = 5)):
            user_message = chat.messages.create(text = "Hello!", is_from_user = True)
            self.assertEqual(chat.last_modified_at(), user_message.last_modified_at)
            self.assertEqual(chat.last_modified_at(), user_message.created_at)

        with freeze_time(time_to_freeze + timedelta(minutes = 10)):
            bot_message = chat.messages.create(text = "Hello! How are you?", is_from_user = False)
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
        chat = user.chats.create(title = "Test chat")
        user_message = chat.messages.create(text = "Hello!", is_from_user = True)
        bot_message = chat.messages.create(text = "Hi!", is_from_user = False, model = "Qwen3-VL:4B")
        self.assertEqual(user_message.chat, chat)
        self.assertEqual(bot_message.chat, chat)
        self.assertEqual(user_message.text, "Hello!")
        self.assertEqual(bot_message.text, "Hi!")
        self.assertTrue(user_message.is_from_user)
        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(user_message.model, "")
        self.assertEqual(bot_message.model, "Qwen3-VL:4B")
        self.assertHasAttr(user_message, "files")
        self.assertHasAttr(bot_message, "files")
        self.assertEqual(user_message.files.count(), 0)
        self.assertEqual(bot_message.files.count(), 0)

    def test_valid_models(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        for m in ["", "Gemma3:1B", "Qwen3-VL:4B"]:
            chat.messages.create(text = "Hi!", is_from_user = False, model = m)
        self.assertEqual(models.Message.objects.count(), 3)

    def test_invalid_models(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        for m in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]:
            with self.assertRaises(ValidationError) as cm:
                chat.messages.create(text = "Hi!", is_from_user = False, model = m)
        self.assertEqual(dict(cm.exception), {"model": [f"Value '{m}' is not a valid choice."]})
        self.assertEqual(models.Message.objects.count(), 0)

    def test_invalid_models_with_bulk_create(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        with self.assertRaises(ValidationError) as cm:
            chat.messages.bulk_create([
                models.Message(chat = chat, text = "Hello!", is_from_user = False, model = invalid_model)
                for invalid_model in ["invalid", -1, 0, 1, -5.5, 0.0, 1.23, False, True]
            ])
        self.assertEqual(dict(cm.exception), {"model": [f"Value 'invalid' is not a valid choice."]})
        self.assertEqual(models.Message.objects.count(), 0)

class MessageFile(TestCase):
    def test_creation(self):
        user = create_user()
        chat = user.chats.create(title = "Test chat")
        message = chat.messages.create(text = "Hello!", is_from_user = True)
        message_file = message.files.create(
            name = "document.txt",
            content = "This is a document about...".encode(),
            content_type = "text/plain"
        )
        self.assertEqual(message_file.message, message)
        self.assertEqual(message_file.name, "document.txt")
        self.assertEqual(message_file.content, "This is a document about...".encode())
        self.assertEqual(message_file.content_type, "text/plain")

class GuestIdentity(TestCase):
    def test_creation(self):
        with freeze_time(timezone.datetime(2025, 1, 1, 12)):
            identity, token = models.GuestIdentity.create("", "")

            self.assertEqual(models.GuestIdentity.objects.count(), 1)
            self.assertEqual(models.User.objects.count(), 1)

            self.assertEqual(type(identity), models.GuestIdentity)
            self.assertEqual(identity.expires_at, timezone.now() + timedelta(days = 30))
            self.assertEqual(identity.last_used_at, timezone.now())
            self.assertEqual(identity.created_at, timezone.now())
            self.assertEqual(identity.ip_address, "")
            self.assertEqual(identity.user_agent_hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

            self.assertEqual(type(token), str)
            self.assertEqual(len(token), 43)

            user = identity.user
            self.assertEqual(type(user), models.User)

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