from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode

from .models import Chat, User

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user: User = await self.get_user_from_cookie()
        self.chat: Chat | None = None

        if self.user is None or isinstance(self.user, AnonymousUser):
            return await self.close()
        else:
            chat_uuid = self.scope["url_route"]["kwargs"].get("chat_uuid")
            if chat_uuid:
                try:
                    self.chat: Chat = await Chat.objects.aget(user = self.user, uuid = chat_uuid)
                    await self.channel_layer.group_add(f"chat_{str(self.chat.uuid)}", self.channel_name)
                except Chat.DoesNotExist:
                    return await self.close()
            else:
                return await self.close()

        await self.accept()

    async def disconnect(self, code):
        if self.chat:
            await self.channel_layer.group_discard(f"chat_{str(self.chat.uuid)}", self.channel_name)

    async def send_token(self, event):
        await self.send_json({"token": event["token"], "message_index": event["message_index"]})

    async def send_message(self, event):
        await self.send_json({"message": event["message"], "message_index": event["message_index"]})

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