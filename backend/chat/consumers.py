import random
from typing import get_args

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode

from .models import Chat, Message, MessageFile, User
from .tasks import ModelName, cancel_chat_task, generate_message, get_incomplete_chats, reset_stopped_incomplete_chats

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user: User = await self.get_user_from_cookie()
        self.chat: Chat | None = None

        if self.user is None or isinstance(self.user, AnonymousUser):
            await self.close()
            return
        else:
            try:
                chat_uuid = self.scope["url_route"]["kwargs"].get("chat_uuid")
                if chat_uuid:
                    self.chat: Chat = await database_sync_to_async(Chat.objects.get)(user = self.user, uuid = chat_uuid)
                    await self.channel_layer.group_add(self.get_group_name(), self.channel_name)
            except Chat.DoesNotExist:
                await self.close()
                return

        await self.reset_stopped_incomplete_chats()
        await self.accept()

    async def disconnect(self, code):
        if self.chat:
            await self.channel_layer.group_discard(self.get_group_name(), self.channel_name)

    async def receive_json(self, content):
        action = content.get("action", "new_message")

        if action == "stop_message":
            incomplete_chats = await self.get_incomplete_chats()
            if len(incomplete_chats) > 0:
                await database_sync_to_async(cancel_chat_task)(str(incomplete_chats[0].uuid))
            return

        chat_uuid = content.get("chat_uuid")
        if chat_uuid:
            if type(chat_uuid) == str:
                self.chat = await database_sync_to_async(Chat.objects.get)(user = self.user, uuid = chat_uuid)
            else:
                await self.close()
                return

        await self.reset_stopped_incomplete_chats()
        incomplete_chats = await self.get_incomplete_chats()
        if len(incomplete_chats) > 0:
            await self.close()
            return

        model = content.get("model", "SmolLM2-135M")
        if model not in get_args(ModelName):
            model = "SmolLM2-135M"

        message = content.get("message")
        if type(message) != str:
            message = ""

        message_index = content.get("message_index")
        if type(message_index) != int:
            message_index = -1

        files = content.get("files", [])
        if type(files) != list:
            files = []

        options = content.get("options", {})
        if type(options) != dict:
            options = {}
        options = parse_options(options)

        match action:
            case "new_message":
                await self.handle_new_message(model, message, files, options)
            case "edit_message":
                await self.handle_edit_message(model, message, message_index, options)
            case "regenerate_message":
                await self.handle_regenerate_message(model, message_index, options)
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

    async def handle_new_message(self, model_name: ModelName, message: str, files: list[dict[str, str]], options: dict[str, int | float]):
        user_message = await database_sync_to_async(Message.objects.create)(chat = self.chat, text = message, is_user_message = True)
        if len(files) > 0:
            await database_sync_to_async(MessageFile.objects.bulk_create)(
                [MessageFile(message = user_message, file = file["file"], name = file["name"]) for file in files]
            )

        bot_message = await database_sync_to_async(Message.objects.create)(chat = self.chat, text = "", is_user_message = False)

        await generate_message(self.chat, user_message, bot_message, model_name, options)

    async def handle_edit_message(self, model_name: ModelName, message: str, message_index: int, options: dict[str, int | float]):
        messages = await self.get_messages()

        user_message = messages[message_index]
        user_message.text = message
        await database_sync_to_async(user_message.save)()

        bot_message = messages[message_index + 1]
        bot_message.text = ""
        await database_sync_to_async(bot_message.save)()

        await generate_message(self.chat, user_message, bot_message, model_name, options)

    async def handle_regenerate_message(self, model_name: ModelName, message_index: int, options: dict[str, int | float]):
        messages = await self.get_messages()

        user_message = messages[message_index - 1]

        bot_message = messages[message_index]
        bot_message.text = ""
        await database_sync_to_async(bot_message.save)()

        options["seed"] = random.randint(0, 1_000_000_000)
        await generate_message(self.chat, user_message, bot_message, model_name, options)

    @database_sync_to_async
    def get_incomplete_chats(self) -> list[Chat]:
        return get_incomplete_chats(self.user)

    @database_sync_to_async
    def reset_stopped_incomplete_chats(self):
        reset_stopped_incomplete_chats(self.user)

    @database_sync_to_async
    def get_messages(self) -> list[Message]:
        return list(Message.objects.filter(chat = self.chat).order_by("date_time"))

    def get_group_name(self) -> str:
        return f"chat_{str(self.chat.uuid)}"

    async def send_token(self, event):
        await self.send_json({"token": event["token"], "message_index": event["message_index"]})

    async def send_message(self, event):
        await self.send_json({"message": event["message"], "message_index": event["message_index"]})

def parse_options(options: dict[str, int | float]):
    def clamp(number: int | float, minimum: int | float, maximum: int | float):
        return max(min(number, maximum), minimum)

    return {
        "num_predict": clamp(options.get("max_tokens", 256), 32, 4096),
        "temperature": clamp(options.get("temperature", 0.2), 0.01, 10),
        "top_p": clamp(options.get("top_p", 0.9), 0.01, 10),
        "seed": options.get("seed", 0)
    }