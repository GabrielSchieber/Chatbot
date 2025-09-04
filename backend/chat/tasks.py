import asyncio
import logging
import threading
from typing import Literal, get_args

logger = logging.getLogger(__name__)

import ollama
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer

from .models import Chat, Message, MessageFile, User

ModelName = Literal["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

global_chat_threads: dict[str, threading.Thread] = {}

def generate_message(chat: Chat, user_message: Message, bot_message: Message, model_name: ModelName):
    global global_chat_threads

    def runner():
        asyncio.run(sample_model(chat, user_message, bot_message, model_name))
        global_chat_threads.pop(str(chat.uuid), None)
        chat.is_pending = False
        chat.save()

    if str(chat.uuid) in global_chat_threads:
        global_chat_threads[str(chat.uuid)].join(0.1)
        global_chat_threads.pop(str(chat.uuid))

    thread = threading.Thread(target = runner)
    thread.start()
    global_chat_threads[str(chat.uuid)] = thread

async def sample_model(chat: Chat, user_message: Message, bot_message: Message, model_name: ModelName):
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
        async for part in await ollama.AsyncClient().chat(model_name, messages, stream = True, options = {"num_predict": 256}):
            token = part["message"]["content"]
            bot_message.text += token
            await database_sync_to_async(bot_message.save)()
            await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})
            await asyncio.sleep(0.1)
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

def stop_pending_chats(user: User):
    global global_chat_threads

    pending_chats = Chat.objects.filter(user = user, is_pending = True)
    if pending_chats.count() > 0:
        for pending_chat in pending_chats:
            chat_thread = global_chat_threads.pop(str(pending_chat.uuid), None)
            if chat_thread:
                chat_thread.join(0.01)
            pending_chat.is_pending = False
            pending_chat.save()

def reset_stopped_pending_chats(user: User):
    global global_chat_threads

    pending_chats = Chat.objects.filter(user = user, is_pending = True)
    if pending_chats.count() > 0:
        for pending_chat in pending_chats:
            if str(pending_chat.uuid) in global_chat_threads:
                if not global_chat_threads[str(pending_chat.uuid)].is_alive():
                    pending_chat.is_pending = False
                    pending_chat.save()
                    global_chat_threads.pop(str(pending_chat.uuid))
            else:
                pending_chat.is_pending = False
                pending_chat.save()

def is_any_user_chat_pending(user: User) -> bool:
    reset_stopped_pending_chats(user)
    pending_chats = Chat.objects.filter(user = user, is_pending = True)
    return True if pending_chats.count() > 0 else False