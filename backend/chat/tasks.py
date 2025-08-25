import asyncio
import dataclasses
import logging
from typing import Literal, get_args

logger = logging.getLogger(__name__)

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from ollama import AsyncClient

from .models import Chat, Message, MessageFile, User

ModelName = Literal["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B"]
type MessageAction = Literal["new_message", "edit_message", "regenerate_message"]

@dataclasses.dataclass(frozen = True)
class ChatTask:
    chat_uuid: str
    message_action: MessageAction

global_chat_tasks: dict[ChatTask, asyncio.Task[None]] = {}

async def generate_message(chat: Chat, user_message: Message, bot_message: Message, model_name: ModelName, message_action: MessageAction):
    async def sample_model():
        chat.is_complete = False
        await database_sync_to_async(chat.save)()

        messages: list[dict[str, str]] = await database_sync_to_async(get_messages)(chat, user_message)
        messages.pop()
        message_index = len(messages) - 1

        try:
            async for part in await AsyncClient().chat(model_name, messages, stream = True, options = options):
                token = part["message"]["content"]
                bot_message.text += token
                await database_sync_to_async(bot_message.save)()
                await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})
        except asyncio.CancelledError:
            chat.is_complete = True
            await database_sync_to_async(chat.save)()
            return

        await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": bot_message.text, "message_index": message_index})

        chat.is_complete = False
        await database_sync_to_async(chat.save)()

    if model_name not in get_args(ModelName):
        raise ValueError(f"Invalid model name: \"{model_name}\"")
    model_name = model_name.lower().replace("-", ":")

    options = {"num_predict": 256, "temperature": 0.2, "top_p": 0.9, "seed": 0}
    channel_layer = get_channel_layer()

    chat_task = ChatTask(str(chat.uuid), message_action)
    task = asyncio.create_task(sample_model())
    task.add_done_callback(lambda t: task_done_callback(t, chat_task))

    global global_chat_tasks
    global_chat_tasks[chat_task] = task

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

    user_files = []
    for m in user_messages:
        message_files = MessageFile.objects.filter(message = m)
        user_files.append([{"file": file.file.path, "name": file.name} for file in message_files])

    messages = []
    for user_message, user_message_files, bot_message in zip(user_messages, user_files, bot_messages):
        messages.extend([
            {"role": "user", "content": get_message_with_files(user_message.text, user_message_files)},
            {"role": "assistant", "content": bot_message.text}
        ])
    return messages

def get_message_with_files(message: str, files: list[dict[str, str]]) -> str:
    if len(files) == 0:
        return message

    file_contents = []
    for file in files:
        with open(file["file"], encoding = "utf-8") as file_reader:
            file_contents.append(f"=== File: {file["name"]} ===\n{file_reader.read()}")

    return f"{message}\n\nFiles:\n{"\n\n".join(file_contents)}"

def get_incomplete_chats(user: User) -> list[Chat]:
    return list(Chat.objects.filter(user = user, is_complete = False))

def reset_incomplete_chats(user: User):
    non_complete_chats = get_incomplete_chats(user)
    chat_uuids_in_tasks = [task for task in global_chat_tasks]
    for chat in non_complete_chats:
        if str(chat.uuid) not in chat_uuids_in_tasks:
            chat.is_complete = True
            chat.save()

def get_running_chat_task_for_chat(chat: Chat):
    if not chat.is_complete:
        for task in global_chat_tasks:
            if str(chat.uuid) == task.chat_uuid:
                return task

def cancel_chat_task(chat_task: ChatTask):
    task = global_chat_tasks.get(chat_task)
    if task and not task.done():
        task.cancel()
    try:
        chat = Chat.objects.get(uuid = chat_task.chat_uuid)
        chat.is_complete = True
        chat.save()
    except Exception:
        pass