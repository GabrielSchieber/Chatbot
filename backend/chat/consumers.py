from typing import get_args

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode

from .models import Chat, Message, MessageFile, User
from .sample import Model
from .tasks import create_generate_message_task, get_group_name, get_non_complete_chats, get_running_chat_task_for_chat, reset_non_complete_chats

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = await self.get_user_from_cookie()
        self.chat = None
        self.redirect = None

        if self.user is None or isinstance(self.user, AnonymousUser):
            await self.close()
            return
        else:
            try:
                chat_uuid = self.scope["url_route"]["kwargs"].get("chat_uuid")
                if chat_uuid:
                    self.chat = await database_sync_to_async(Chat.objects.get)(user = self.user, uuid = chat_uuid)
                    await self.channel_layer.group_add(self.get_group_name(), self.channel_name)
            except Chat.DoesNotExist:
                await self.close()
                return

        await self.reset_non_complete_chats()

        await self.accept()

        if self.chat:
            running_chat_task = get_running_chat_task_for_chat(self.chat)
            if running_chat_task:
                await self.send_json({"generating_message_action": running_chat_task.message_action, "generating_message_index": running_chat_task.message_index})

    async def disconnect(self, code):
        if self.chat:
            await self.channel_layer.group_discard(self.get_group_name(), self.channel_name)

    async def receive_json(self, content):
        non_complete_chats = await self.get_non_complete_chats()

        if len(non_complete_chats) == 0:
            if not self.chat:
                self.chat = await self.create_chat()
                self.redirect = f"/chat/{self.chat.uuid}"
                await self.channel_layer.group_add(self.get_group_name(), self.channel_name)
        else:
            await self.reset_non_complete_chats()
            non_complete_chats = await self.get_non_complete_chats()
            if len(non_complete_chats) != 0:
                await self.close()
                return

        action = content.get("action", "new_message")

        model = content.get("model", "SmolLM2-135M")
        if model not in get_args(Model):
            model = "SmolLM2-135M"

        message = content.get("message")

        match action:
            case "new_message":
                if not message:
                    await self.close()
                    return

                files = content.get("files", [])

                await self.handle_new_message(model, message, files)
            case "edit_message":
                if not message:
                    await self.close()
                    return

                message_index = content.get("message_index")
                if message_index is None:
                    await self.close()
                    return

                await self.handle_edit_message(model, message, message_index)
            case "regenerate_message":
                message_index = content.get("message_index")
                if message_index is None:
                    await self.close()
                    return

                await self.handle_regenerate_message(model, message_index)
            case _:
                await self.close()

    @database_sync_to_async
    def get_user_from_cookie(self):
        try:
            raw_cookie = self.scope["headers"]
            cookie_dict = {}
            for header, value in raw_cookie:
                if header == b"cookie":
                    cookies = value.decode().split(";")
                    for cookie in cookies:
                        if "=" in cookie:
                            k, v = cookie.strip().split("=", 1)
                            cookie_dict[k] = v

            token = cookie_dict.get("access_token")
            if not token:
                return AnonymousUser()

            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms = ["HS256"])
            user_id = decoded_data.get("user_id")
            return User.objects.get(id = user_id)
        except Exception:
            return AnonymousUser()

    async def handle_new_message(self, model: Model, message: str, files: list[dict[str, str]]):
        message_index = await database_sync_to_async(Message.objects.filter)(chat = self.chat)
        message_index = await database_sync_to_async(message_index.count)()

        user_message = await database_sync_to_async(Message.objects.create)(chat = self.chat, text = message, is_user_message = True)
        if len(files) > 0:
            await database_sync_to_async(MessageFile.objects.bulk_create)(
                [MessageFile(message = user_message, file = file["file"], name = file["name"]) for file in files]
            )

        bot_message = await database_sync_to_async(Message.objects.create)(chat = self.chat, text = "", is_user_message = False)

        await create_generate_message_task(self.chat, model, user_message, bot_message, message_index, "new_message")

    async def handle_edit_message(self, model: Model, message: str, message_index: int):
        messages = await self.get_messages()

        user_message = messages[message_index]
        user_message.text = message
        await database_sync_to_async(user_message.save)()

        bot_message = messages[message_index + 1]
        bot_message.text = ""
        await database_sync_to_async(bot_message.save)()

        await create_generate_message_task(self.chat, model, user_message, bot_message, message_index, "edit_message")

    async def handle_regenerate_message(self, model: Model, message_index: int):
        messages = await self.get_messages()

        user_message = messages[message_index - 1]

        bot_message = messages[message_index]
        bot_message.text = ""
        await database_sync_to_async(bot_message.save)()

        await create_generate_message_task(self.chat, model, user_message, bot_message, message_index, "regenerate_message")

    @database_sync_to_async
    def create_chat(self) -> Chat:
        return Chat.objects.create(user = self.user, title = f"Chat {Chat.objects.filter(user = self.user).count() + 1}")

    @database_sync_to_async
    def get_non_complete_chats(self) -> list[Chat]:
        return get_non_complete_chats(self.user)

    @database_sync_to_async
    def reset_non_complete_chats(self):
        reset_non_complete_chats(self.user)

    @database_sync_to_async
    def get_messages(self) -> list[Message]:
        return list(Message.objects.filter(chat = self.chat).order_by("date_time"))

    @database_sync_to_async
    def get_message_at_index(self, index: int) -> Message:
        return Message.objects.filter(chat = self.chat)[index]

    def get_group_name(self) -> str:
        return get_group_name(self.chat)

    async def send_token(self, event):
        await self.send_json({"token": event["token"], "message_index": event["message_index"]})

    async def send_message(self, event):
        await self.send_json({"message": event["message"], "message_index": event["message_index"]})
        if self.redirect:
            await self.send_json({"redirect": self.redirect})