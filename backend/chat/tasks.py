import asyncio
import logging
import os
import random
import threading
from concurrent.futures import CancelledError
from typing import Literal, get_args

logger = logging.getLogger(__name__)

import ollama
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.core.exceptions import ObjectDoesNotExist

from .models import Chat, Message, MessageFile, User

ModelName = Literal["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

def start_background_loop(loop: asyncio.AbstractEventLoop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

global_loop = asyncio.new_event_loop()
threading.Thread(target = start_background_loop, args = [global_loop], daemon = True).start()

global_futures: dict[str, asyncio.Future[None]] = {}

def generate_message(chat: Chat, user_message: Message, bot_message: Message, model_name: ModelName, options: dict[str, int | float]):
    future = asyncio.run_coroutine_threadsafe(sample_model(chat, user_message, bot_message, model_name, options), global_loop)
    future.add_done_callback(lambda f: task_done_callback(f, str(chat.uuid)))
    global_futures[str(chat.uuid)] = future

def task_done_callback(future: asyncio.Future[None], chat_uuid: str):
    global_futures.pop(chat_uuid, None)

    try:
        exception = future.exception()
    except CancelledError:
        return

    if exception:
        logger.exception("Task failed", exc_info = exception)

async def sample_model(chat: Chat, user_message: Message, bot_message: Message, model_name: ModelName, options: dict[str, int | float]):
    if model_name not in get_args(ModelName):
        raise ValueError(f"Invalid model name: \"{model_name}\"")

    if model_name == "Moondream":
        model_name = "moondream:1.8b-v2-q2_K"
    else:
        model_name = model_name.lower().replace("-", ":")

    if not model_name in str(ollama.list()):
        raise ValueError(f"Model {model_name} not installed")

    channel_layer = get_channel_layer()

    chat.is_pending = True
    await chat.asave()

    messages: list[dict[str, str]] = await database_sync_to_async(get_messages)(chat, user_message)
    message_index = len(messages) - 1

    try:
        async for part in await ollama.AsyncClient().chat(model_name, messages, stream = True, options = parse_options(options)):
            token = part["message"]["content"]
            bot_message.text += token
            if not await safe_save_message(bot_message):
                return
            await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})
    except asyncio.CancelledError:
        chat.is_pending = False
        await safe_save_chat(chat)
        return

    await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": bot_message.text, "message_index": message_index})

    chat.is_pending = False
    await chat.asave()

def get_messages(chat: Chat, stop_user_message: Message) -> list[dict[str, str]]:
    user_messages = list(Message.objects.filter(chat = chat, is_from_user = True).order_by("created_at"))
    bot_messages = list(Message.objects.filter(chat = chat, is_from_user = False).order_by("created_at"))

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
    return messages

def get_user_message(message: Message) -> dict[str, str]:
    files: list[MessageFile] = list(message.files.all())

    if len(files) == 0:
        return {"role": "user", "content": message.text, "images": []}

    images = []
    for file in files:
        if "image" in file.content_type:
            os.makedirs("chat_temp", exist_ok = True)
            with open(f"chat_temp/{file.name}", "wb+") as writer:
                writer.write(file.content)
            images.append(f"chat_temp/{file.name}")

    file_contents = []
    for file in files:
        if "image" not in file.content_type:
            file_contents.append(f"=== File: {file.name} ===\n{file.content.decode()}")

    content = f"{message.text}\n\nFiles:\n{"\n\n".join(file_contents)}" if len(file_contents) > 0 else message.text

    return {"role": "user", "content": content, "images": images}

def stop_pending_chats(user: User):
    pending_chats = Chat.objects.filter(user = user, is_pending = True)
    if pending_chats.count() > 0:
        for pending_chat in pending_chats:
            if str(pending_chat.uuid) in global_futures:
                global_futures[str(pending_chat.uuid)].cancel()

            pending_chat.is_pending = False
            pending_chat.save()

def reset_stopped_pending_chats(user: User):
    pending_chats = Chat.objects.filter(user = user, is_pending = True)
    if pending_chats.count() > 0:
        for pending_chat in pending_chats:
            if str(pending_chat.uuid) in global_futures:
                if global_futures[str(pending_chat.uuid)].done():
                    pending_chat.is_pending = False
                    pending_chat.save()
                    global_futures.pop(str(pending_chat.uuid))
            else:
                pending_chat.is_pending = False
                pending_chat.save()

def is_any_user_chat_pending(user: User) -> bool:
    reset_stopped_pending_chats(user)
    pending_chats = Chat.objects.filter(user = user, is_pending = True)
    return True if pending_chats.count() > 0 else False

def parse_options(options: dict[str, int | float]) -> dict[str, int | float]:
    def clamp(value: int | float, minimum: int | float, maximum: int | float) -> int | float:
        return max(min(value, maximum), minimum)

    return  {
        "num_predict": clamp(int(options.get("num_predict", 256)), 32, 4096),
        "temperature": clamp(float(options.get("temperature", 0.2)), 0.1, 2.0),
        "top_p": clamp(float(options.get("top_p", 0.9)), 0.1, 2.0),
        "seed": int(options.get("seed", random.randint(-(10 ** 10), 10 ** 10)))
    }

async def safe_save_message(bot_message: Message):
    try:
        exists = await database_sync_to_async(Chat.objects.filter(pk = bot_message.chat_id).exists)()
        if not exists:
            return False
        await bot_message.asave()
        return True
    except ObjectDoesNotExist:
        return False

async def safe_save_chat(chat: Chat):
    exists = await database_sync_to_async(Chat.objects.filter(pk = chat.pk).exists)()
    if not exists:
        return False
    await chat.asave()
    return True