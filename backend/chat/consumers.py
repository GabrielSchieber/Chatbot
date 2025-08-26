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
            self.chat = await database_sync_to_async(Chat.objects.get)(user = self.user, uuid = chat_uuid)

        await self.reset_stopped_incomplete_chats()
        incomplete_chats = await self.get_incomplete_chats()
        if len(incomplete_chats) > 0:
            await self.close()
            return

        model = content.get("model", "SmolLM2-135M")
        if model not in get_args(ModelName):
            model = "SmolLM2-135M"

        message = content.get("message")

        options = content.get("options")
        options = parse_options(options)

        match action:
            case "new_message":
                if not message:
                    await self.close()
                    return

                files = content.get("files", [])

                await self.handle_new_message(model, message, files, options)
            case "edit_message":
                if not message:
                    await self.close()
                    return

                message_index = content.get("message_index")
                if message_index is None:
                    await self.close()
                    return

                await self.handle_edit_message(model, message, message_index, options)
            case "regenerate_message":
                message_index = content.get("message_index")
                if message_index is None:
                    await self.close()
                    return

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

def parse_options(options: dict[str, int | float] | None):
    def clamp(number: int | float, minimum: int | float, maximum: int | float):
        return max(min(number, maximum), minimum)

    new_options = {"num_predict": 256, "temperature": 0.2, "top_p": 0.9, "seed": 0}

    if options:
        if "max_tokens" in options:
            max_tokens = int(options["max_tokens"])
            new_options["num_predict"] = clamp(max_tokens, 32, 4096)
        if "temperature" in options:
            temperature = float(options["temperature"])
            new_options["temperature"] = clamp(temperature, 0.01, 10)
        if "top_p" in options:
            top_p = float(options["top_p"])
            new_options["top_p"] = clamp(top_p, 0.01, 10)
        if "seed" in options:
            seed = int(options["seed"])
            new_options["seed"] = seed

    return new_options