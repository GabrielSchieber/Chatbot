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
        self.assertFalse(chat.is_pending)

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
        response = self.client.get("/api/logout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

    def test_logout_without_being_authenticated(self):
        response = self.client.get("/api/logout/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication credentials were not provided.")

    def test_me(self):
        user, _ = self.create_and_login_user()
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], user.id)
        self.assertEqual(response.json()["email"], user.email)

    def test_get_message(self):
        response = self.client.post("/api/get-message/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/get-message/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912", "message_index": 0})
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
        response = self.client.post("/api/get-message/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912", "message_index": 0})
        self.assertEqual(response.status_code, 400)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.post("/api/get-message/", {"chat_uuid": chat.uuid, "message_index": 0})
        self.assertEqual(response.status_code, 400)

        Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        Message.objects.create(chat = chat, text = "Hi!", is_from_user = False)

        response = self.client.post("/api/get-message/", {"chat_uuid": chat.uuid, "message_index": 0})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "Hello!")

        response = self.client.post("/api/get-message/", {"chat_uuid": chat.uuid, "message_index": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "Hi!")

    def test_get_messages(self):
        response = self.client.post("/api/get-messages/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/get-messages/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912"})
        self.assertEqual(response.status_code, 401)

        user, _ = self.create_and_login_user()
        response = self.client.post("/api/get-messages/", {"chat_uuid": "849087f8-4b3f-47f1-980d-5a5a3d325912"})
        self.assertEqual(response.status_code, 404)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.post("/api/get-messages/", {"chat_uuid": "invalid-uuid"})
        self.assertEqual(response.status_code, 404)

        chat = Chat.objects.create(user = user, title = "Test chat")
        response = self.client.post("/api/get-messages/", {"chat_uuid": chat.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["messages"], [])

        Message.objects.create(chat = chat, text = "Hello!", is_from_user = True)
        Message.objects.create(chat = chat, text = "Hi!", is_from_user = False)

        response = self.client.post("/api/get-messages/", {"chat_uuid": chat.uuid})
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"text": "Hello!", "is_from_user": True, "files": [], "model": None},
            {"text": "Hi!", "is_from_user": False, "files": [], "model": None}
        ]
        self.assertEqual(response.json()["messages"], expected_messages)

        Message.objects.create(chat = chat, text = "Hello again!", is_from_user = True)
        Message.objects.create(chat = chat, text = "Hi again!", is_from_user = False)

        response = self.client.post("/api/get-messages/", {"chat_uuid": chat.uuid})
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"text": "Hello!", "is_from_user": True, "files": [], "model": None},
            {"text": "Hi!", "is_from_user": False, "files": [], "model": None},
            {"text": "Hello again!", "is_from_user": True, "files": [], "model": None},
            {"text": "Hi again!", "is_from_user": False, "files": [], "model": None}
        ]
        self.assertEqual(response.json()["messages"], expected_messages)

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

        expected_chats = [{"title": chat1.title, "is_pending": False, "uuid": str(chat1.uuid)}]
        self.assertEqual(response.json()["chats"], expected_chats)

        chat2 = Chat.objects.create(user = user1, title = "Test chat 2")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"title": chat2.title, "is_pending": False, "uuid": str(chat2.uuid)},
            {"title": chat1.title, "is_pending": False, "uuid": str(chat1.uuid)}
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

        expected_chats = [{"title": chat3.title, "is_pending": False, "uuid": str(chat3.uuid)}]
        self.assertEqual(response.json()["chats"], expected_chats)

        chat4 = Chat.objects.create(user = user2, title = "Test chat 4")
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"title": chat4.title, "is_pending": False, "uuid": str(chat4.uuid)},
            {"title": chat3.title, "is_pending": False, "uuid": str(chat3.uuid)}
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
        self.assertEqual(response.json()["chats"], [])

        chat = Chat.objects.create(user = user, title = "A question about math")

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        response = self.client.get("/api/search-chats/?search=A question about math")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "A question about math", "uuid": str(chat.uuid), "matches": []}])

        Message.objects.create(chat = chat, text = "What is math?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Math is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "A question about math", "uuid": str(chat.uuid), "matches": ["What is math?"]}])

        response = self.client.get("/api/search-chats/?search=math")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "A question about math", "uuid": str(chat.uuid), "matches": ["What is math?", "Math is..."]}])

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        chat = Chat.objects.create(user = user, title = "Geometry question")

        response = self.client.get("/api/search-chats/?search=Question about geometry")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [])

        response = self.client.get("/api/search-chats/?search=Geometry question")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "Geometry question", "uuid": str(chat.uuid), "matches": []}])

        Message.objects.create(chat = chat, text = "What is geometry?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Geometry is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "Geometry question", "uuid": str(chat.uuid), "matches": ["What is geometry?"]}])

        response = self.client.get("/api/search-chats/?search=geometry")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["chats"], [{"title": "Geometry question", "uuid": str(chat.uuid), "matches": ["What is geometry?", "Geometry is..."]}])

    def test_rename_chat(self):
        response = self.client.post("/api/rename-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Test title")
        response = self.client.post("/api/rename-chat/", {"chat_uuid": "test-uuid", "new_title": "Some title"})
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/rename-chat/", {"chat_uuid": chat1.uuid, "new_title": "Some title"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.first().title, "Some title")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat2 = Chat.objects.create(user = user2, title = "Some chat")
        response = self.client.post("/api/rename-chat/", {"chat_uuid": chat2.uuid, "new_title": "Some other chat"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("Some title", [Chat.objects.first().title, Chat.objects.last().title])
        self.assertIn("Some other chat", [Chat.objects.first().title, Chat.objects.last().title])

    def test_delete_chat(self):
        response = self.client.post("/api/delete-chat/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 400)

        chat1 = Chat.objects.create(user = user1, title = "Test chat 1")

        response = self.client.post("/api/delete-chat/", {"chat_uuid": "test-uuid"})
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/delete-chat/", {"chat_uuid": chat1.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 2")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = Chat.objects.create(user = user2, title = "Test chat 3")
        response = self.client.post("/api/delete-chat/", {"chat_uuid": chat3.uuid})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Chat.objects.first().user, user1)

    def test_delete_chats(self):
        response = self.client.get("/api/delete-chats/")
        self.assertEqual(response.status_code, 401)

        user1 = create_user()
        response = self.client.get("/api/delete-chats/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.get("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)

        Chat.objects.create(user = user1, title = "Test chat 1")
        response = self.client.get("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 2")
        Chat.objects.create(user = user1, title = "Test chat 3")

        response = self.client.get("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 0)

        Chat.objects.create(user = user1, title = "Test chat 4")
        Chat.objects.create(user = user1, title = "Test chat 5")

        self.logout_user()
        user2, _ = self.create_and_login_user("someone@example.com", "somepassword")
        Chat.objects.create(user = user2, title = "Test chat 6")
        Chat.objects.create(user = user2, title = "Test chat 7")
        response = self.client.get("/api/delete-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Chat.objects.count(), 2)
        self.assertEqual(Chat.objects.first().user, user1)
        self.assertEqual(Chat.objects.last().user, user1)

    def test_delete_account(self):
        response = self.client.get("/api/delete-account/")
        self.assertEqual(response.status_code, 401)

        create_user()
        response = self.client.get("/api/delete-account/")
        self.assertEqual(response.status_code, 401)

        self.login_user()
        response = self.client.get("/api/delete-account/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 0)

        create_user()
        user = create_user("someone@example.com", "somepassword")

        self.login_user("test@example.com", "testpassword")
        response = self.client.get("/api/delete-account/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.first(), user)

    def login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        return self.client.post("/api/login/", {"email": email, "password": password})

    def logout_user(self):
        return self.client.post("/api/logout/")

    def create_and_login_user(self, email: str = "test@example.com", password: str = "testpassword"):
        user = create_user(email, password)
        response = self.client.post("/api/login/", {"email": email, "password": password})
        return user, response

def create_user(email: str = "test@example.com", password: str = "testpassword") -> User:
    return User.objects.create_user(email = email, password = password)