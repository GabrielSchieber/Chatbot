import asyncio
import logging

logger = logging.getLogger(__name__)

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from ollama import AsyncClient

from .models import Chat, Message, User

global_chat_tasks: dict[str, asyncio.Task[None]] = {}

async def generate_message(chat: Chat, user_message: Message, bot_message: Message):
    async def sample_model():
        chat.is_complete = False
        await database_sync_to_async(chat.save)()

        messages: list[dict[str, str]] = await database_sync_to_async(get_messages)(chat, user_message)
        messages.pop()
        message_index = len(messages) - 1

        async for part in await AsyncClient().chat("smollm2:135m", messages, stream = True, options = options):
            token = part["message"]["content"]
            bot_message.text += token
            await database_sync_to_async(bot_message.save)()
            await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})

        await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": bot_message.text, "message_index": message_index})

        chat.is_complete = False
        await database_sync_to_async(chat.save)()

    options = {"num_predict": 256, "temperature": 0.2, "top_p": 0.9, "seed": 0}
    channel_layer = get_channel_layer()
    task = asyncio.create_task(sample_model())
    task.add_done_callback(lambda t: task_done_callback(t, str(chat.uuid)))

    global global_chat_tasks
    global_chat_tasks[str(chat.uuid)] = task

def task_done_callback(task: asyncio.Task[None], chat_uuid: str):
    global global_chat_tasks
    global_chat_tasks.pop(chat_uuid)
    exception = task.exception()
    return exception and logger.exception("Task failed", exc_info = task.exception())

def get_messages(chat: Chat, stop_user_message: Message) -> list[dict[str, str]]:
    user_messages = list(Message.objects.filter(chat = chat, is_user_message = True).order_by("date_time"))
    bot_messages = list(Message.objects.filter(chat = chat, is_user_message = False).order_by("date_time"))

    for i, m in enumerate(user_messages):
        if m == stop_user_message:
            user_messages = user_messages[:i + 1]
            bot_messages = bot_messages[:i + 1]

    messages = []
    for user_message, bot_message in zip(user_messages, bot_messages):
        messages.extend([
            {"role": "user", "content": user_message.text},
            {"role": "assistant", "content": bot_message.text}
        ])
    return messages

def get_non_complete_chats(user: User) -> list[Chat]:
    return list(Chat.objects.filter(user = user, is_complete = False))

def reset_incomplete_chats(user: User):
    non_complete_chats = get_non_complete_chats(user)
    chat_uuids_in_tasks = [task for task in global_chat_tasks]
    for chat in non_complete_chats:
        if str(chat.uuid) not in chat_uuids_in_tasks:
            chat.is_complete = True
            chat.save()