import asyncio
from typing import get_args

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.html import escape
from jwt import decode as jwt_decode

from .models import Chat, Message, User
from .sample import Model, sample_model
from .utils import markdown_to_html

generate_message_tasks: dict[str, asyncio.Task] = {}

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

        await self.accept()
        if self.chat and not self.chat.is_complete:
            message = await database_sync_to_async(self.chat.messages.last)()
            await self.send_json({"recover": message.text})

    async def disconnect(self, code):
        if self.chat:
            await self.channel_layer.group_discard(self.get_group_name(), self.channel_name)

    async def receive_json(self, content):
        model = content["model"]
        if model not in get_args(Model):
            model = "SmolLM2-135M"
        message = content["message"]
        files = content.get("files", [])

        non_complete_chats = await self.get_non_complete_chats()

        if len(non_complete_chats) == 0:
            if not self.chat:
                self.chat = await self.create_chat()
                self.redirect = f"/chat/{self.chat.uuid}"
                await self.channel_layer.group_add(self.get_group_name(), self.channel_name)

            generate_message_tasks[self.chat.uuid] = asyncio.create_task(self.generate_message(model, message, files))
        else:
            for chat in non_complete_chats:
                if chat.uuid not in generate_message_tasks:
                    chat.is_complete = True
                    await database_sync_to_async(chat.save)()

            non_complete_chats = await self.get_non_complete_chats()
            if len(non_complete_chats) == 0:
                await self.receive_json(content)
                return

            await self.send_json({"redirect": f"/chat/{non_complete_chats[0].uuid}"})

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

    async def generate_message(self, model: Model, message: str, files: list[dict[str, str]]):
        self.chat.is_complete = False
        await database_sync_to_async(self.chat.save)()

        messages = await self.get_messages(message, files)
        await database_sync_to_async(Message.objects.create)(chat = self.chat, text = message, is_user_message = True)
        bot_message = await database_sync_to_async(Message.objects.create)(chat = self.chat, text = "", is_user_message = False)

        async for token in sample_model(model, messages, 256):
            bot_message.text += token
            await database_sync_to_async(bot_message.save)()
            await self.channel_layer.group_send(f"chat_{self.chat.uuid}", {"type": "send_token", "token": escape(token)})

        self.chat.is_complete = True
        await database_sync_to_async(self.chat.save)()
        generate_message_tasks.pop(self.chat.uuid)

        await self.channel_layer.group_send(f"chat_{self.chat.uuid}", {"type": "send_message", "message": markdown_to_html(bot_message.text)})

    @database_sync_to_async
    def get_messages(self, new_user_message: str, new_files: list[dict[str, str]]) -> list[dict[str, str]]:
        user_messages = [m.text for m in Message.objects.filter(chat = self.chat, is_user_message = True)]
        bot_messages = [m.text for m in Message.objects.filter(chat = self.chat, is_user_message = False)]
        messages = []
        for user_message, bot_message in zip(user_messages, bot_messages):
            messages.extend([
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": bot_message}
            ])
        user_message_with_files = get_message_with_files(new_user_message, new_files)
        messages.append({"role": "user", "content": user_message_with_files})
        return messages

    @database_sync_to_async
    def create_chat(self) -> Chat:
        return Chat.objects.create(user = self.user, title = f"Chat {Chat.objects.filter(user = self.user).count() + 1}")

    @database_sync_to_async
    def get_non_complete_chats(self) -> list[Chat]:
        return list(Chat.objects.filter(user = self.user, is_complete = False))

    def get_group_name(self) -> str:
        return f"chat_{self.chat.uuid}"

    async def send_token(self, event):
        await self.send_json({"token": event["token"]})

    async def send_message(self, event):
        await self.send_json({"message": event["message"]})
        if self.redirect:
            await self.send_json({"redirect": self.redirect})

def get_message_with_files(message: str, files: list[dict[str, str]]) -> str:
    if len(files) == 0:
        return message

    file_contents = []
    for file in files:
        with open(file["file"], encoding = "utf-8") as file_reader:
            file_contents.append(f"=== File: {file["name"]} ===\n{file_reader.read()}")

    return f"{message}\n\nFiles:\n{"\n\n".join(file_contents)}"