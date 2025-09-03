import asyncio
import logging
from typing import Literal, get_args

logger = logging.getLogger(__name__)

import ollama
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer

from .models import Chat, Message, MessageFile

ModelName = Literal["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

async def generate_message(chat: Chat, user_message: Message, bot_message: Message, model_name: ModelName):
    if model_name not in get_args(ModelName):
        raise ValueError(f"Invalid model name: \"{model_name}\"")

    if model_name == "Moondream":
        model_name = "moondream:1.8b-v2-q2_K"
    else:
        model_name = model_name.lower().replace("-", ":")

    channel_layer = get_channel_layer()

    chat.is_pending = True
    await database_sync_to_async(chat.save)()

    messages: list[dict[str, str]] = await database_sync_to_async(get_messages)(chat, user_message)
    message_index = len(messages) - 1

    try:
        async for part in await ollama.AsyncClient().chat(model_name, messages, stream = True, options = {"num_predict": 128}):
            token = part["message"]["content"]
            bot_message.text += token
            await database_sync_to_async(bot_message.save)()
            await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})
    except asyncio.CancelledError:
        chat.is_pending = False
        await database_sync_to_async(chat.save)()
        return

    await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": bot_message.text, "message_index": message_index})

    chat.is_pending = False
    await database_sync_to_async(chat.save)()

def get_messages(chat: Chat, stop_user_message: Message) -> list[dict[str, str]]:
    user_messages = list(Message.objects.filter(chat = chat, role = "User").order_by("created_at"))
    bot_messages = list(Message.objects.filter(chat = chat, role = "Bot").order_by("created_at"))

    for i, m in enumerate(user_messages):
        if m == stop_user_message:
            user_messages = user_messages[:i + 1]
            bot_messages = bot_messages[:i + 1]

    messages = []
    for user_message, bot_message in zip(user_messages, bot_messages):
        messages.extend([
            get_user_message(user_message),
            {"role": "assistant", "content": bot_message.text}
        ])
    messages.pop()
    print(f"\nmessages:\n{messages}\n")
    return messages

def get_user_message(message: Message) -> dict[str, str]:
    files: list[MessageFile] = list(message.files.all())

    if len(files) == 0:
        return {"role": "user", "content": message.text, "images": []}

    images = []
    for file in files:
        if "image" in file.content_type:
            with open(f"chat_temp/{file.name}", "wb+") as writer:
                writer.write(file.content)
            images.append(f"chat_temp/{file.name}")

    file_contents = []
    for file in files:
        if "image" not in file.content_type:
            file_contents.append(f"=== File: {file.name} ===\n{file.content.decode()}")

    content = f"{message.text}\n\nFiles:\n{"\n\n".join(file_contents)}" if len(file_contents) > 0 else message.text

    return {"role": "user", "content": content, "images": images}