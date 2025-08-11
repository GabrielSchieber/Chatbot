from channels.db import database_sync_to_async
from channels.layers import get_channel_layer

from .models import Chat, Message, MessageFile
from .sample import Model, sample_model

async def generate_message(chat: Chat, model: Model, user_message: Message, bot_message: Message):
    chat.is_complete = False
    await database_sync_to_async(chat.save)()

    messages = await get_messages(chat, user_message)
    messages.pop()
    message_index = len(messages) - 1

    group_name = get_group_name(chat)
    channel_layer = get_channel_layer()

    async for token in sample_model(model, messages, 32):
        bot_message.text += token
        await database_sync_to_async(bot_message.save)()
        await channel_layer.group_send(group_name, {"type": "send_token", "token": token, "message_index": message_index})

    await channel_layer.group_send(group_name, {"type": "send_message", "message": bot_message.text, "message_index": message_index})

    chat.is_complete = True
    await database_sync_to_async(chat.save)()

@database_sync_to_async
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

def get_group_name(chat: Chat) -> str:
    return f"chat_{chat.uuid}"