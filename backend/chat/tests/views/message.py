import uuid
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.client import encode_multipart, BOUNDARY

from ..utils import ViewsTestCase
from ...models import Chat, Message, MessageFile, User

class GetMessageFileContent(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/get-message-file-content/", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "message_file_id": ["This field is required."]})

        response = self.client.get("/api/get-message-file-content/?chat_uuid=123", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."], "message_file_id": ["This field is required."]})

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={uuid.uuid4()}&message_file_id=1", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

        chat1 = user.chats.create(title = "File Analysis")
        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat1.uuid}&message_file_id=1", **{"HTTP_ACCEPT": "application/json"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Message file was not found."})

        message1 = chat1.messages.create(text = "Describe the file.", is_from_user = True)
        message_file1 = message1.files.create(
            name = "document.txt",
            content = "This is a document about...".encode(),
            content_type = "text/plain"
        )

        response = self.client.get(f"/api/get-message-file-content/?chat_uuid={chat1.uuid}&message_file_id={message_file1.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, "This is a document about...".encode())

        chat2 = user.chats.create(title = "Another File Analysis")
        message2 = chat2.messages.create(text = "Describe the files.", is_from_user = True)
        message_file2 = message2.files.create(
            name = "another_document.txt",
            content = "This is another document about...".encode(),
            content_type = "text/plain"
        )
        message_file3 = message2.files.create(
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

class GetMessageFileIDs(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "File Analysis")
        message1 = chat.messages.create(text = "Describe the files.", is_from_user = True)
        message1.files.bulk_create([
            MessageFile(message = message1, name = f"File {i + 1}.txt", content = f"Document {i + 1}".encode(), content_type = "text/plain")
            for i in range(5)
        ])

        response = self.client.get(f"/api/get-message-file-ids/?chat_uuid={chat.uuid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [[1, 2, 3, 4, 5]])

        message2 = chat.messages.create(text = "Describe these other files.", is_from_user = True)
        message2.files.bulk_create([
            MessageFile(message = message2, name = f"File {i + 1}.txt", content = f"Document {i + 1}".encode(), content_type = "text/plain")
            for i in range(5, 10)
        ])

        response = self.client.get(f"/api/get-message-file-ids/?chat_uuid={chat.uuid}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]])

    def test_requires_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.get(f"/api/get-message-file-ids/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."]})

    def test_invalid_chat_uuid(self):
        self.create_and_login_user()
        response = self.client.get(f"/api/get-message-file-ids/?chat_uuid=invalid")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    def test_chat_was_not_found(self):
        self.create_and_login_user()
        response = self.client.get(f"/api/get-message-file-ids/?chat_uuid={str(uuid.uuid4())}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

class GetMessages(ViewsTestCase):
    def test(self):
        user = self.create_and_login_user()
        response = self.client.get("/api/get-messages/?chat_uuid=849087f8-4b3f-47f1-980d-5a5a3d325912")
        self.assertEqual(response.status_code, 404)

        chat = user.chats.create(title = "Test chat")
        response = self.client.get("/api/get-messages/?chat_uuid=invalid_uuid")
        self.assertEqual(response.status_code, 400)

        chat = user.chats.create(title = "Test chat")
        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

        user_message_1 = chat.messages.create(text = "Hello!", is_from_user = True)
        bot_message_1 = chat.messages.create(text = "Hi!", is_from_user = False)

        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"id": user_message_1.id, "text": "Hello!", "is_from_user": True, "files": [], "model": ""},
            {"id": bot_message_1.id, "text": "Hi!", "is_from_user": False, "files": [], "model": ""}
        ]
        self.assertEqual(response.json(), expected_messages)

        user_message_2 = chat.messages.create(text = "Hello again!", is_from_user = True)
        bot_message_2 = chat.messages.create(text = "Hi again!", is_from_user = False)

        response = self.client.get(f"/api/get-messages/?chat_uuid={str(chat.uuid)}")
        self.assertEqual(response.status_code, 200)

        expected_messages = [
            {"id": user_message_1.id, "text": "Hello!", "is_from_user": True, "files": [], "model": ""},
            {"id": bot_message_1.id, "text": "Hi!", "is_from_user": False, "files": [], "model": ""},
            {"id": user_message_2.id, "text": "Hello again!", "is_from_user": True, "files": [], "model": ""},
            {"id": bot_message_2.id, "text": "Hi again!", "is_from_user": False, "files": [], "model": ""}
        ]
        self.assertEqual(response.json(), expected_messages)

class NewMessage(ViewsTestCase):
    @patch("chat.views.message.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user = self.create_and_login_user()

        file1 = SimpleUploadedFile("file1.txt", b"hello world", "text/plain")
        data = {"chat_uuid": "", "text": "Hello assistant!", "model": "Qwen3-VL:4B", "files": [file1]}

        response = self.client.post("/api/new-message/", data, format = "multipart")
        self.assertEqual(response.status_code, 200)

        chats = user.chats
        self.assertEqual(chats.count(), 1)

        chat = chats.first()
        self.assertIsNotNone(chat)

        self.assertIn("uuid", response.data)
        self.assertEqual(response.data["uuid"], str(chat.uuid))

        messages = chat.messages.order_by("created_at")
        self.assertEqual(messages.count(), 2)

        user_message = messages[0]
        bot_message = messages[1]

        self.assertTrue(user_message.is_from_user)
        self.assertEqual(user_message.text, "Hello assistant!")

        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(bot_message.model, "Qwen3-VL:4B")
        self.assertEqual(bot_message.text, "")

        chat.refresh_from_db()
        self.assertEqual(chat.pending_message, bot_message)

        files = user_message.files
        self.assertEqual(files.count(), 1)

        file = files.first()
        self.assertEqual(file.name, "file1.txt")
        self.assertEqual(file.content, b"hello world")
        self.assertEqual(file.content_type, "text/plain")

        mock_generate.assert_called_once()
        call_arguments = mock_generate.call_args[0]

        self.assertEqual(call_arguments[0], chat)
        self.assertTrue(call_arguments[1])

    @patch("chat.views.message.is_any_user_chat_pending", return_value = True)
    def test_cannot_send_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "A chat is already pending."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.message.generate_pending_message_in_chat")
    def test_creates_new_chat_without_chat_uuid(self, mock_task, _):
        self.create_and_login_user()

        response = self.client.post("/api/new-message/", {"text": "Hello!"}, format = "multipart")
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

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.message.generate_pending_message_in_chat")
    def test_post_to_existing_chat(self, mock_task, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Test Chat")

        response = self.client.post("/api/new-message/", {"chat_uuid": str(chat.uuid), "text": "hello"}, format = "multipart")
        self.assertEqual(response.status_code, 200)

        self.assertEqual(Chat.objects.count(), 1)
        chat.refresh_from_db()
        self.assertEqual(chat.pending_message, Message.objects.get(is_from_user = False))

        mock_task.assert_called_once()
        arguments, _ = mock_task.call_args
        self.assertFalse(arguments[1])

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_chat_was_not_found(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"chat_uuid": str(uuid.uuid4()), "text": "hello"}, format = "multipart")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_invalid_chat_uuid_format(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"chat_uuid": "NOT-A-UUID", "text": "hello"}, format = "multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_invalid_model(self, _):
        self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"chat_uuid": "", "text": "hello", "model": "INVALID"}, format = "multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"model": ['"INVALID" is not a valid choice.']})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_too_many_files(self, _):
        self.create_and_login_user()
        files = [SimpleUploadedFile(f"file{i + 1}.txt", f"Document {i + 1}".encode(), "text/plain") for i in range(11)]
        data = {"chat_uuid": "", "text": "Describe the files.", "model": "Qwen3-VL:4B", "files": files}
        response = self.client.post("/api/new-message/", data, format = "multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"files": ["Ensure this field has no more than 10 elements."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_files_too_large(self, _):
        self.create_and_login_user()

        def post_and_assert(files: list[SimpleUploadedFile]):
            data = {"chat_uuid": "", "text": "Describe the file.", "model": "Qwen3-VL:4B", "files": files}
            response = self.client.post("/api/new-message/", data, format = "multipart")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"files": ["Total file size exceeds limit of 5 MB."]})

        test_sizes = [
            [5_000_001],
            [2_500_000, 2_500_001],
            [1_000_000 for _ in range(5)],
            [1_000_000 for _ in range(10)]
        ]
        test_sizes[2][-1] += 1
        test_sizes[3][-1] += 1

        for sizes in test_sizes:
            files = []
            for i, s in enumerate(sizes):
                files.append(SimpleUploadedFile(f"file{i + 1}.txt", bytes([b % 255 for b in range(s)]), "text/plain"))
            post_and_assert(files)

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    @patch("chat.views.message.generate_pending_message_in_chat")
    def test_temporary_chat(self, _1, _2):
        user = self.create_and_login_user()
        response = self.client.post("/api/new-message/", {"text": "Hello!", "temporary": True}, format = "multipart")
        self.assertEqual(response.status_code, 200)

        self.assertTrue(User.objects.count(), 1)
        self.assertEqual(user.chats.count(), 1)

        chat = user.chats.first()
        self.assertEqual(chat.title, "Chat 1")
        self.assertIsNotNone(chat.pending_message)
        self.assertTrue(chat.is_temporary)
        self.assertFalse(chat.is_archived)

        self.assertTrue(Message.objects.count(), 2)
        self.assertEqual(chat.messages.count(), 2)

        user_message = chat.messages.first()
        self.assertEqual(user_message.text, "Hello!")
        self.assertTrue(user_message.is_from_user)
        self.assertEqual(user_message.model, "")

        bot_message = chat.messages.last()
        self.assertEqual(bot_message.text, "")
        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(bot_message.model, "Qwen3-VL:4B")

class EditMessage(ViewsTestCase):
    @patch("chat.views.message.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user = self.create_and_login_user()

        chat = user.chats.create(title = "Greetings")
        user_message = chat.messages.create(text = "Hello!", is_from_user = True)
        bot_message = chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False)

        data = {"chat_uuid": str(chat.uuid), "index": 0, "text": "Hi! How are you?"}

        body = encode_multipart(BOUNDARY, data)
        content_type = f"multipart/form-data; boundary={BOUNDARY}"

        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        chat.refresh_from_db()
        user_message.refresh_from_db()
        bot_message.refresh_from_db()
        self.assertEqual(chat.title, "Greetings")
        self.assertEqual(chat.pending_message, bot_message)
        self.assertEqual(user_message.text, "Hi! How are you?")
        self.assertEqual(bot_message.text, "")
        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)

        mock_generate.assert_called_once()
        call_arguments = mock_generate.call_args[0]

        self.assertEqual(call_arguments[0], chat)

    @patch("chat.views.message.is_any_user_chat_pending", return_value = True)
    def test_cannot_edit_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/edit-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "A chat is already pending."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_chat_uuid_and_index(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/edit-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "index": ["This field is required."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_chat_uuid(self, _):
        self.create_and_login_user()
        for chat_uuid in ["", "NOT-A-UUID", "123", "abdc5678"]:
            body = encode_multipart(BOUNDARY, {"chat_uuid": chat_uuid, "index": 0})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/edit-message/", body, content_type)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_chat_was_not_found(self, _):
        self.create_and_login_user()
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(uuid.uuid4()), "index": 0})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_index(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["This field is required."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_model(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        chat.messages.create(text = "Hello!", is_from_user = True)
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)," index": 0, "model": "INVALID"})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"model": ['"INVALID" is not a valid choice.']})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_too_many_files(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "File Analysis")
        message = chat.messages.create(text = "Describe the files.", is_from_user = True)
        message.files.bulk_create([
            MessageFile(message = message, name = f"file{i + 1}.txt", content = f"Document {i + 1}".encode(), content_type = "text/plain")
            for i in range(5)
        ])
        chat.messages.create(text = "The files are about...", is_from_user = False)

        files = [SimpleUploadedFile(f"file{i + 6}.txt", f"Document {i + 6}".encode(), "text/plain") for i in range(6)]
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "text": "Describe the files.", "index": 0, "added_files": files})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Total number of files exceeds the limit of 10."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_files_too_large(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "File Analysis")
        chat.messages.create(text = "Describe the files.", is_from_user = True)
        chat.messages.create(text = "The files are about...", is_from_user = False)

        def post_and_assert(files: list[SimpleUploadedFile]):
            body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "text": "Describe the files.", "index": 0, "added_files": files})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/edit-message/", body, content_type)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"detail": "Total file size exceeds limit of 5 MB."})

        test_sizes = [
            [5_000_001],
            [2_500_000, 2_500_001],
            [1_000_000 for _ in range(5)],
            [1_000_000 for _ in range(10)]
        ]
        test_sizes[2][-1] += 1
        test_sizes[3][-1] += 1

        for sizes in test_sizes:
            files = []
            for i, s in enumerate(sizes):
                files.append(SimpleUploadedFile(f"file{i + 1}.txt", bytes([b % 255 for b in range(s)]), "text/plain"))
            post_and_assert(files)

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_remove_files(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(user = user, title = "File Analysis")
        message = chat.messages.create(chat = chat, text = "Describe the files.", is_from_user = True)
        message.files.bulk_create([
            MessageFile(message = message, name = f"File {i + 1}.txt", content = f"Content {i + 1}".encode(), content_type = "text/plain") 
            for i in range(5)
        ])
        chat.messages.create(chat = chat, text = "The files are about...", is_from_user = False)

        self.assertEqual(MessageFile.objects.count(), 5)
        for i, f in enumerate(MessageFile.objects.all()):
            self.assertEqual(f"File {i + 1}.txt", f.name)

        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "text": "Describe the files.", "index": 0, "removed_file_ids": [2, 4]})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        self.assertEqual(MessageFile.objects.count(), 3)
        for i, f in zip([1, 3, 5], MessageFile.objects.all()):
            self.assertEqual(f"File {i}.txt", f.name)

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_index_out_of_range(self, _):
        def test(chat: Chat, index: int):
            body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": index})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/edit-message/", body, content_type)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"detail": "Index out of range."})

        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        test(chat, 0)

        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False)
        test(chat, 1)

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_negative_index(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": -1})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["Ensure this value is greater than or equal to 0."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_add_and_remove_files(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(user = user, title = "File Analysis")
        message = chat.messages.create(chat = chat, text = "Describe the files.", is_from_user = True)
        message.files.bulk_create([
            MessageFile(message = message, name = f"File {i + 1}.txt", content = f"Content {i + 1}".encode(), content_type = "text/plain") 
            for i in range(5)
        ])
        chat.messages.create(chat = chat, text = "The files are about...", is_from_user = False, model = "Qwen3-VL:4B")

        added_files = [SimpleUploadedFile(f"File {i + 6}.txt", f"Document {i + 6}".encode(), "text/plain") for i in range(2)]
        body = encode_multipart(
            BOUNDARY,
            {
                "chat_uuid": str(chat.uuid),
                "text": "Describe the files.",
                "index": 0,
                "added_files": added_files,
                "removed_file_ids": [1, 3, 4]
            }
        )
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/edit-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        self.assertEqual(MessageFile.objects.count(), 4)
        message.refresh_from_db()
        self.assertEqual(message.files.count(), 4)
        for file, i in zip(message.files.order_by("created_at"), [2, 5, 6, 7]):
            self.assertEqual(file.name, f"File {i}.txt")

        self.assertEqual(Message.objects.count(), 2)
        self.assertEqual(Message.objects.last().text, "")

class RegenerateMessage(ViewsTestCase):
    @patch("chat.views.message.generate_pending_message_in_chat")
    def test(self, mock_generate):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        user_message = chat.messages.create(text = "Hello!", is_from_user = True)
        bot_message = chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False, model = "Qwen3-VL:4B")

        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": 1, "model": "Gemma3:1B"})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 200)

        chat.refresh_from_db()
        user_message.refresh_from_db()
        bot_message.refresh_from_db()

        self.assertEqual(chat.title, "Greetings")
        self.assertEqual(chat.pending_message, bot_message)

        self.assertTrue(user_message.text, "Hello!")
        self.assertTrue(user_message.is_from_user)

        self.assertEqual(bot_message.text, "")
        self.assertFalse(bot_message.is_from_user)
        self.assertEqual(bot_message.model, "Gemma3:1B")

        self.assertEqual(Chat.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)
        self.assertEqual(MessageFile.objects.count(), 0)

        mock_generate.assert_called_once()

        self.assertEqual(mock_generate.call_args[0][0], chat)
        self.assertTrue(mock_generate.call_args[1]["should_randomize"])

    @patch("chat.views.message.is_any_user_chat_pending", return_value = True)
    def test_cannot_regenerate_while_a_chat_is_pending(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/regenerate-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "A chat is already pending."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_chat_uuid_and_index(self, _):
        self.create_and_login_user()
        response = self.client.patch("/api/regenerate-message/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"chat_uuid": ["This field is required."], "index": ["This field is required."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_chat_uuid(self, _):
        self.create_and_login_user()
        for chat_uuid in ["", "NOT-A-UUID", "123", "abdc5678"]:
            body = encode_multipart(BOUNDARY, {"chat_uuid": chat_uuid, "index": 0})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/regenerate-message/", body, content_type)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"chat_uuid": ["Must be a valid UUID."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_chat_was_not_found(self, _):
        self.create_and_login_user()
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(uuid.uuid4()), "index": 0})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Chat was not found."})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_index(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["This field is required."]})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_requires_valid_model(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False)
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid)," index": 1, "model": "INVALID"})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"model": ['"INVALID" is not a valid choice.']})

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_index_out_of_range(self, _):
        def test(chat: Chat, index: int):
            body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": index})
            content_type = f"multipart/form-data; boundary={BOUNDARY}"
            response = self.client.patch("/api/regenerate-message/", body, content_type)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"detail": "Index out of range."})

        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        test(chat, 0)

        chat.messages.create(text = "Hello!", is_from_user = True)
        chat.messages.create(text = "Hello! How can I help you today?", is_from_user = False)
        test(chat, 2)

    @patch("chat.views.message.is_any_user_chat_pending", return_value = False)
    def test_negative_index(self, _):
        user = self.create_and_login_user()
        chat = user.chats.create(title = "Greetings")
        body = encode_multipart(BOUNDARY, {"chat_uuid": str(chat.uuid), "index": -1})
        content_type = f"multipart/form-data; boundary={BOUNDARY}"
        response = self.client.patch("/api/regenerate-message/", body, content_type)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"index": ["Ensure this value is greater than or equal to 0."]})