import uuid

from ..utils import ViewsTestCase
from ...models import Chat, Message, User

class GetChat(ViewsTestCase):
    def test(self):
        user1 = self.create_and_login_user()
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

        chat1 = Chat.objects.create(user = user1, title = "Greetings")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat1.uuid), "title": "Greetings", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat2 = Chat.objects.create(user = user1, title = "Math Question")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat2.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat2.uuid),"title": "Math Question", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat3 = Chat.objects.create(user = user1, title = "Weather Inquiry", is_archived = True)
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat3.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat3.uuid),"title": "Weather Inquiry", "pending_message_id": None, "is_archived": True, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        chat4 = Chat.objects.create(user = user1, title = "Joke Request")
        chat4.pending_message = Message.objects.create(chat = chat4, text = "Tell me a joke.", is_from_user = True)
        chat4.save()
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat4.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat4.uuid),"title": "Joke Request", "pending_message_id": 1, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat1.uuid), "title": "Greetings", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 3}
        self.assertEqual(response.json(), expected_json)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        response = self.client.get("/api/get-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

        chat5 = Chat.objects.create(user = user2, title = "Travel Advice")
        response = self.client.get(f"/api/get-chat/?chat_uuid={chat5.uuid}")
        self.assertEqual(response.status_code, 200)
        expected_json = {"uuid": str(chat5.uuid), "title": "Travel Advice", "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": 0}
        self.assertEqual(response.json(), expected_json)

        response = self.client.get(f"/api/get-chat/?chat_uuid={chat1.uuid}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class GetChats(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat.uuid), "title": chat.title, "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": i}
            for i, chat in enumerate(user.chats.order_by("-created_at"))
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

    def test_user_without_chats(self):
        self.create_and_login_user()
        response = self.client.get("/api/get-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"chats": [], "has_more": False})

    def test_offset(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/get-chats/?offset={5}")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat.uuid), "title": chat.title, "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": i + 5}
            for i, chat in enumerate(user.chats.order_by("-created_at")[5:])
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

    def test_limit(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/get-chats/?limit={5}")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat.uuid), "title": chat.title, "pending_message_id": None, "is_archived": False, "is_temporary": False, "index": i}
            for i, chat in enumerate(user.chats.order_by("-created_at")[:5])
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": True})

    def test_pending(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(5)])

        chat1 = user.chats.order_by("created_at")[0]
        chat1.pending_message = chat1.messages.create(text = "Hello!", is_from_user = False)
        chat1.save()
        chat3 = user.chats.order_by("created_at")[2]
        chat3.pending_message = chat1.messages.create(text = "Hi!", is_from_user = False)
        chat3.save()

        response = self.client.get(f"/api/get-chats/?pending=true")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat3.uuid), "title": chat3.title, "pending_message_id": 2, "is_archived": False, "is_temporary": False, "index": 2},
            {"uuid": str(chat1.uuid), "title": chat1.title, "pending_message_id": 1, "is_archived": False, "is_temporary": False, "index": 4}
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

    def test_archived(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(5)])

        chat1 = user.chats.order_by("created_at")[0]
        chat1.is_archived = True
        chat1.save()
        chat3 = user.chats.order_by("created_at")[2]
        chat3.is_archived = True
        chat3.save()

        response = self.client.get(f"/api/get-chats/?archived=true")
        self.assertEqual(response.status_code, 200)

        expected_chats = [
            {"uuid": str(chat3.uuid), "title": chat3.title, "pending_message_id": None, "is_archived": True, "is_temporary": False, "index": 2},
            {"uuid": str(chat1.uuid), "title": chat1.title, "pending_message_id": None, "is_archived": True, "is_temporary": False, "index": 4}
        ]
        self.assertEqual(response.json(), {"chats": expected_chats, "has_more": False})

class SearchChats(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        chat = Chat.objects.create(user = user, title = "A question about math")

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        response = self.client.get("/api/search-chats/?search=A question about math")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": [],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        Message.objects.create(chat = chat, text = "What is math?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Math is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is math?")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": ["What is math?"],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=math")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "A question about math",
            "matches": ["What is math?", "Math is..."],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        chat = Chat.objects.create(user = user, title = "Geometry question")

        response = self.client.get("/api/search-chats/?search=Question about geometry")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

        response = self.client.get("/api/search-chats/?search=Geometry question")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": [],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        Message.objects.create(chat = chat, text = "What is geometry?", is_from_user = True)
        Message.objects.create(chat = chat, text = "Geometry is...", is_from_user = False)

        response = self.client.get("/api/search-chats/?search=What is geometry?")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": ["What is geometry?"],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=geometry")
        self.assertEqual(response.status_code, 200)

        expected_entries = [{
            "uuid": str(chat.uuid),
            "title": "Geometry question",
            "matches": ["What is geometry?", "Geometry is..."],
            "is_archived": False,
            "last_modified_at": chat.last_modified_at().isoformat()
        }]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_user_without_chats(self):
        self.create_and_login_user()
        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"entries": [], "has_more": False})

    def test_user_with_chats(self):
        user = self.create_and_login_user()
        self.create_example_chats_for_user(user)

        response = self.client.get("/api/search-chats/")
        self.assertEqual(response.status_code, 200)

        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [m.text for m in chat.messages.all()],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in user.chats.order_by("-created_at")
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_search(self):
        user = self.create_and_login_user()
        self.create_example_chats_for_user(user)

        response = self.client.get("/api/search-chats/?search=Hello")
        self.assertEqual(response.status_code, 200)

        expected_chat = user.chats.get(title = "Greetings")
        expected_entries = [
            {
                "uuid": str(expected_chat.uuid),
                "title": expected_chat.title,
                "matches": [m.text for m in expected_chat.messages.all()],
                "is_archived": False,
                "last_modified_at": expected_chat.last_modified_at().isoformat()
            }
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

        response = self.client.get("/api/search-chats/?search=are")
        self.assertEqual(response.status_code, 200)

        expected_chats = [user.chats.get(title = "Travel Advice"), user.chats.get(title = "Greetings")]
        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [m.text for m in chat.messages.filter(text__icontains = "are")],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in expected_chats
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_offset(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/search-chats/?offset={5}")
        self.assertEqual(response.status_code, 200)

        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in user.chats.order_by("-created_at")[5:]
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": False})

    def test_limit(self):
        user = self.create_and_login_user()
        user.chats.bulk_create([Chat(user = user, title = f"Chat {i + 1}") for i in range(10)])

        response = self.client.get(f"/api/search-chats/?limit={5}")
        self.assertEqual(response.status_code, 200)

        expected_entries = [
            {
                "uuid": str(chat.uuid),
                "title": chat.title,
                "matches": [],
                "is_archived": False,
                "last_modified_at": chat.last_modified_at().isoformat()
            }
            for chat in user.chats.order_by("-created_at")[:5]
        ]
        self.assertEqual(response.json(), {"entries": expected_entries, "has_more": True})

    def create_example_chats_for_user(self, user: User):
        chat = user.chats.create(title = "Greetings")
        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How are you?", is_from_user = False)

        chat = user.chats.create(title = "Weather Inquiry")
        chat.messages.create(text = "What's the weather like today?", is_from_user = True)
        chat.messages.create(text = "It's sunny with a high of 28°C.", is_from_user = False)

        chat = user.chats.create(title = "Travel Advice")
        chat.messages.create(text = "What's the best time to visit Japan?", is_from_user = True)
        chat.messages.create(text = "Spring and autumn are ideal for pleasant weather and beautiful scenery.", is_from_user = False)
        chat.messages.create(text = "Thanks! I'll plan for April.", is_from_user = True)
        chat.messages.create(text = "Great choice! Cherry blossoms are stunning that time of year.", is_from_user = False)

class RenameChat(ViewsTestCase):
    def test(self):
        def rename(chat_uuid: str, new_title: str):
            response =  self.client.patch("/api/rename-chat/", {"chat_uuid": chat_uuid, "new_title": new_title}, "application/json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = Chat.objects.create(user = user1, title = "Test title")

        rename(chat1.uuid, "Greetings")
        self.assertEqual(Chat.objects.first().title, "Greetings")

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat2 = Chat.objects.create(user = user2, title = "Some chat")

        rename(chat2.uuid, "Travel Advice")

        chats = Chat.objects.order_by("created_at")
        self.assertEqual(chats.last().title, "Travel Advice")
        self.assertEqual(chats.first().title, "Greetings")

        self.assertEqual(chats.first().user, user1)
        self.assertEqual(chats.last().user, user2)

    def test_requires_chat_uuid_and_new_title(self):
        self.create_and_login_user()
        response = self.client.patch("/api/rename-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "new_title": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": "invalid", "new_title": "Some Chat"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.patch("/api/rename-chat/", {"chat_uuid": str(uuid.uuid4()), "new_title": "Some Chat"}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class ArchiveChat(ViewsTestCase):
    def test(self):
        def archive(chat: Chat):
            response = self.client.patch("/api/archive-chat/", {"chat_uuid": str(chat.uuid)}, "application/json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = user1.chats.create(title = "Greetings")
        chat2 = user1.chats.create(title = "Math Help")
        self.assertFalse(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

        archive(chat1)
        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertTrue(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = user2.chats.create(title = "Travel Advice")
        chat4 = user2.chats.create(title = "Recipe Suggestion")

        archive(chat3)
        chat3.refresh_from_db()
        chat4.refresh_from_db()
        self.assertTrue(chat3.is_archived)
        self.assertFalse(chat4.is_archived)

        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertTrue(chat1.is_archived)
        self.assertFalse(chat2.is_archived)

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/archive-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/archive-chat/", {"chat_uuid": "invalid"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.patch("/api/archive-chat/", {"chat_uuid": str(uuid.uuid4())}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class UnarchiveChat(ViewsTestCase):
    def test(self):
        def unarchive(chat: Chat):
            response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": str(chat.uuid)}, "application/json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = user1.chats.create(title = "Greetings", is_archived = True)
        chat2 = user1.chats.create(title = "Math Help", is_archived = True)
        self.assertTrue(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

        unarchive(chat1)
        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertFalse(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = user2.chats.create(title = "Travel Advice", is_archived = True)
        chat4 = user2.chats.create(title = "Recipe Suggestion", is_archived = True)

        unarchive(chat3)
        chat3.refresh_from_db()
        chat4.refresh_from_db()
        self.assertFalse(chat3.is_archived)
        self.assertTrue(chat4.is_archived)

        chat1.refresh_from_db()
        chat2.refresh_from_db()
        self.assertFalse(chat1.is_archived)
        self.assertTrue(chat2.is_archived)

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": "invalid"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.patch("/api/unarchive-chat/", {"chat_uuid": str(uuid.uuid4())}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class DeleteChat(ViewsTestCase):
    def test(self):
        def delete(chat: Chat):
            response = self.client.delete("/api/delete-chat/", {"chat_uuid": str(chat.uuid)}, "application/json")
            self.assertEqual(response.status_code, 204)
            self.assertEqual(response.content, b"")

        user1 = self.create_and_login_user()
        chat1 = user1.chats.create(title = "Greetings")
        chat2 = user1.chats.create(title = "Math Help")

        delete(chat1)
        self.assertEqual(list(Chat.objects.all()), [chat2])

        self.logout_user()

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        chat3 = user2.chats.create(title = "Travel Advice")
        chat4 = user2.chats.create(title = "Recipe Suggestion")

        delete(chat3)
        self.assertEqual(list(Chat.objects.all()), [chat2, chat4])

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-chat/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": "invalid"}, "application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.delete("/api/delete-chat/", {"chat_uuid": str(uuid.uuid4())}, "application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class ArchiveChats(ViewsTestCase):
    def test(self):
        user1 = self.create_and_login_user()
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

        user2 = self.create_and_login_user("someone@example.com", "somepassword")

        Chat.objects.create(user = user2, title = "Math Question")
        Chat.objects.create(user = user2, title = "Recipe Suggestion")

        response = self.client.patch("/api/archive-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Chat.objects.get(user = user2, title = "Math Question").is_archived)
        self.assertTrue(Chat.objects.get(user = user2, title = "Recipe Suggestion").is_archived)

        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertFalse(c.is_archived)

class UnarchiveChats(ViewsTestCase):
    def test(self):
        user1 = self.create_and_login_user()
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

        user2 = self.create_and_login_user("someone@example.com", "somepassword")

        Chat.objects.create(user = user2, title = "Math Question", is_archived = True)
        Chat.objects.create(user = user2, title = "Recipe Suggestion", is_archived = True)

        response = self.client.patch("/api/unarchive-chats/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Chat.objects.get(user = user2, title = "Math Question").is_archived)
        self.assertFalse(Chat.objects.get(user = user2, title = "Recipe Suggestion").is_archived)

        for c in Chat.objects.filter(user__email = "test@example.com"):
            self.assertTrue(c.is_archived)

class DeleteChats(ViewsTestCase):
    def test(self):
        user1 = self.create_and_login_user()
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
        user2 = self.create_and_login_user("someone@example.com", "somepassword")
        Chat.objects.create(user = user2, title = "Test chat 6")
        Chat.objects.create(user = user2, title = "Test chat 7")
        response = self.client.delete("/api/delete-chats/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Chat.objects.count(), 2)
        self.assertEqual(Chat.objects.first().user, user1)
        self.assertEqual(Chat.objects.last().user, user1)

class StopPendingChats(ViewsTestCase):
    def test(self):
        user1 = self.create_and_login_user()

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

        user2 = self.create_and_login_user("someone@example.com", "somepassword")
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