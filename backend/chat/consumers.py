from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode

from .models import User
from .tasks import opened_chats

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user: User = await self.get_user_from_cookie()
        self.chat_uuid = ""

        if self.user is None or isinstance(self.user, AnonymousUser):
            return await self.close(401, "User not authenticated")

        await self.accept()

    async def disconnect(self, code):
        if self.chat_uuid != "":
            opened_chats.discard(self.chat_uuid)
            await self.channel_layer.group_discard(f"chat_{self.chat_uuid}", self.channel_name)

    async def receive_json(self, content):
        if self.chat_uuid == "":
            self.chat_uuid = str(content.get("chat_uuid", ""))
            try:
                if await database_sync_to_async(self.user.chats.filter(uuid = self.chat_uuid).exists)():
                    await self.channel_layer.group_add(f"chat_{self.chat_uuid}", self.channel_name)
                    opened_chats.add(self.chat_uuid)
            except:
                await self.close()

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