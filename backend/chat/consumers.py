import asyncio

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode

from .models import User
from .tasks import IS_PLAYWRIGHT_TEST, astop_pending_chat, get_ollama_model_and_options, get_system_prompt, ollama_client, opened_chats

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user: User = await self.get_user_from_cookie()
        self.chat_uuid = ""

        if self.user is None or isinstance(self.user, AnonymousUser):
            return await self.close(401, "User not authenticated.")

        await self.accept()

    async def disconnect(self, code):
        if self.chat_uuid != "":
            opened_chats.discard(self.chat_uuid)
            await self.channel_layer.group_discard(f"chat_{self.chat_uuid}", self.channel_name)

            chat = await database_sync_to_async(self.user.chats.filter(uuid = self.chat_uuid, is_temporary = True).first)()
            if chat is not None:
                await astop_pending_chat(chat)

    async def receive_json(self, content):
        if self.chat_uuid != "": return

        if type(content) != dict:
            return await self.close()

        chat_uuid = content.get("chat_uuid")
        if type(chat_uuid) != str:
            return await self.close()

        if await database_sync_to_async(self.user.chats.filter(uuid = chat_uuid).exists)():
            self.chat_uuid = chat_uuid
            await self.channel_layer.group_add(f"chat_{chat_uuid}", self.channel_name)
            opened_chats.add(chat_uuid)

    async def send_token(self, event):
        await self.send_json({"token": event["token"], "message_index": event["message_index"]})

    async def send_message(self, event):
        await self.send_json({"message": event["message"], "message_index": event["message_index"]})

    async def send_title(self, event):
        await self.send_json({"title": event["title"]})

    async def send_end(self, event):
        await self.send_json("end")

    async def get_user_from_cookie(self):
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
            return await User.objects.aget(id = user_id)
        except Exception:
            return AnonymousUser()

class GuestChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.messages = [{"role": "system", "content": get_system_prompt()}]
        self.task = None
        await self.accept()

    async def receive_json(self, content):
        if self.task is None:
            if type(content) != dict:
                return await self.close()

            user_message = content.get("message")
            if type(user_message) != str:
                return await self.close()

            def done_callback(_):
                self.task = None

            self.task = asyncio.create_task(self.generate_message(user_message))
            self.task.add_done_callback(done_callback)
        else:
            if content == "stop":
                self.task.cancel()
                self.task = None

    async def generate_message(self, user_message: str):      
        self.messages.extend([{"role": "user", "content": user_message}, {"role": "assistant", "content": ""}])
        message_index = len(self.messages) - 2

        async for part in await ollama_client.chat(guest_model, self.messages[:-1], stream = True, options = guest_options):
            await asyncio.sleep(0.05)

            token = part.message.content

            if type(token) == str:
                self.messages[-1]["content"] += token
                await self.send_json({"token": token, "message_index": message_index})

        await self.send_json({"message": self.messages[-1]["content"], "message_index": message_index})
        await self.send_json("end")

guest_model, guest_options = get_ollama_model_and_options("SmolLM2-135M")
if IS_PLAYWRIGHT_TEST:
    guest_options["num_predict"] = 64
    guest_options["seed"] = 0