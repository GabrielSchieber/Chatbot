from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode

from .models import Chat, Message, User
from .sample import sample_model
from .utils import markdown_to_html

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = await self.get_user_from_cookie()

        if self.user is None or isinstance(self.user, AnonymousUser):
            await self.close()
            return
        else:
            try:
                chat_uuid = self.scope["url_route"]["kwargs"].get("chat_uuid")
                self.chat = await database_sync_to_async(Chat.objects.get)(user = self.user, uuid = chat_uuid) if chat_uuid else None
            except Chat.DoesNotExist:
                await self.close()
                return

        await self.accept()

    async def receive_json(self, content):
        redirect = None
        if not self.chat:
            self.chat = await self.create_chat()
            await database_sync_to_async(self.chat.save)()
            redirect = f"/chat/{self.chat.uuid}"

        messages = await self.get_messages(content["message"])
        await database_sync_to_async(Message.objects.create)(chat = self.chat, text = content["message"], is_user_message = True)
        bot_message = await database_sync_to_async(Message.objects.create)(chat = self.chat, text = "", is_user_message = False)

        async for token in sample_model(messages, 256):
            bot_message.text += token
            await database_sync_to_async(bot_message.save)()
            await self.send_json({"token": token})

        await self.send_json({"message": markdown_to_html(bot_message.text)})
        if redirect:
            await self.send_json({"redirect": redirect})

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

    @database_sync_to_async
    def get_messages(self, new_user_message: str) -> list[dict[str, str]]:
        user_messages = [m.text for m in Message.objects.filter(chat = self.chat, is_user_message = True)]
        bot_messages = [m.text for m in Message.objects.filter(chat = self.chat, is_user_message = False)]
        messages = []
        for user_message, bot_message in zip(user_messages, bot_messages):
            messages.extend([
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": bot_message}
            ])
        messages.append({"role": "user", "content": new_user_message})
        return messages

    @database_sync_to_async
    def create_chat(self) -> Chat:
        return Chat.objects.create(user = self.user, title = f"Chat {Chat.objects.filter(user = self.user).count() + 1}")