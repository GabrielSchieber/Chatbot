import asyncio
import logging
import os
import random
import threading
from concurrent.futures import CancelledError

logger = logging.getLogger(__name__)

import ollama
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.core.exceptions import ObjectDoesNotExist

channel_layer = get_channel_layer()

from .models import Chat, Message, User

def start_background_loop(loop: asyncio.AbstractEventLoop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

event_loop = asyncio.new_event_loop()
threading.Thread(target = start_background_loop, args = [event_loop], daemon = True).start()

chat_futures: dict[str, asyncio.Future[None]] = {}
opened_chats: set[str] = set()

def generate_pending_message_in_chat(chat: Chat, should_randomize: bool = False):
    if chat.pending_message is not None:
        future = asyncio.run_coroutine_threadsafe(sample_model(chat, should_randomize), event_loop)
        future.add_done_callback(lambda f: task_done_callback(f, str(chat.uuid)))
        chat_futures[str(chat.uuid)] = future

def task_done_callback(future: asyncio.Future[None], chat_uuid: str):
    chat_futures.pop(chat_uuid, None)

    try:
        exception = future.exception()
    except CancelledError:
        return

    if exception:
        logger.exception("Task failed", exc_info = exception)

async def sample_model(chat: Chat, should_randomize: bool):
    model = get_ollama_model(chat.pending_message.model)
    if model not in str(ollama.list()):
        raise ValueError(f"Model {model} not installed")

    options = {
        "num_predict": 256,
        "temperature": random.randint(100, 1000) / 1000 if should_randomize else 0.1,
        "top_p": random.randint(100, 1000) / 1000 if should_randomize else 0.1
    }

    if os.getenv("PLAYWRIGHT_TEST") == "True":
        options["seed"] = 0
    elif should_randomize:
        options["seed"] = random.randint(-(10 ** 10), 10 ** 10)

    messages: list[dict[str, str]] = await get_messages(chat.pending_message)
    message_index = len(messages)

    try:
        async for part in await ollama.AsyncClient().chat(model, messages, stream = True, options = options):
            token = part["message"]["content"]
            chat.pending_message.text += token
            if not await safe_save_message(chat.pending_message):
                return
            if str(chat.uuid) in opened_chats:
                opened_chats.discard(str(chat.uuid))
                await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": chat.pending_message.text, "message_index": message_index})
            else:
                await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})
    except asyncio.CancelledError:
        chat.pending_message = None
        await safe_save_chat(chat)
        return

    await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": chat.pending_message.text, "message_index": message_index})

    chat.pending_message = None
    await chat.asave(update_fields = ["pending_message"])

    await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_end"})

@database_sync_to_async
def get_messages(up_to_message: Message) -> list[dict[str, str]]:
    messages = []
    for message in up_to_message.chat.messages.order_by("created_at"):
        if message.pk == up_to_message.pk:
            break
        messages.append(get_message_dict(message))
    return messages

def get_message_dict(message: Message) -> dict[str, str]:
    if message.is_from_user:
        if message.files.count() == 0:
            return {"role": "user", "content": message.text}

        images = []
        for file in message.files.all():
            if "image" in file.content_type:
                os.makedirs("chat_temp", exist_ok = True)
                with open(f"chat_temp/{file.name}", "wb+") as writer:
                    writer.write(file.content)
                images.append(f"chat_temp/{file.name}")

        file_contents = []
        for file in message.files.all():
            if "image" not in file.content_type:
                file_contents.append(f"=== File: {file.name} ===\n{file.content.decode()}")

        content = f"{message.text}\n\nFiles:\n{"\n\n".join(file_contents)}" if len(file_contents) > 0 else message.text

        return {"role": "user", "content": content, "images": images}
    else:
        return {"role": "assistant", "content": message.text}

def stop_pending_chat(chat: Chat):
    if chat.pending_message is not None and str(chat.uuid) in chat_futures:
        chat_futures[str(chat.uuid)].cancel()
        chat.pending_message = None
        chat.save(update_fields = ["pending_message"])

def stop_user_pending_chats(user: User):
    pending_chats = Chat.objects.filter(user = user).exclude(pending_message = None)

    if pending_chats.count() > 0:
        for pending_chat in pending_chats:
            if str(pending_chat.uuid) in chat_futures:
                chat_futures[str(pending_chat.uuid)].cancel()

    pending_chats.update(pending_message = None)

def reset_stopped_pending_chats(user: User):
    pending_chats = Chat.objects.filter(user = user).exclude(pending_message = None)
    if pending_chats.count() > 0:
        for pending_chat in pending_chats:
            if str(pending_chat.uuid) not in chat_futures:
                pending_chat.pending_message = None
                pending_chat.save(update_fields = ["pending_message"])

def is_any_user_chat_pending(user: User) -> bool:
    reset_stopped_pending_chats(user)
    pending_chats = Chat.objects.filter(user = user).exclude(pending_message = None)
    return True if pending_chats.count() > 0 else False

def get_ollama_model(model: str):
    if model == "Moondream":
        return "moondream:1.8b-v2-q2_K"
    else:
        return model.lower().replace("-", ":")

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
    await chat.asave(update_fields = ["pending_message"])
    return True