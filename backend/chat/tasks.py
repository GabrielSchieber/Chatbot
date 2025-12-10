import asyncio
import logging
import os
import random
import threading
from concurrent.futures import CancelledError

import ollama
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer

from .models import Chat, Message, User

def generate_pending_message_in_chat(chat: Chat, should_generate_title: bool = False, should_randomize: bool = False):
    if chat.pending_message is not None:
        future = asyncio.run_coroutine_threadsafe(generate_message(chat, should_generate_title, should_randomize), event_loop)
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

async def generate_message(chat: Chat, should_generate_title: bool, should_randomize: bool):
    messages: list[dict[str, str]] = await get_messages(chat.pending_message)
    message_index = len(messages) - 1

    model, options = get_ollama_model_and_options(chat.pending_message.model)

    if IS_PLAYWRIGHT_TEST:
        options["num_predict"] = 64
        options["seed"] = get_test_seed(chat)
    elif should_randomize:
        options["seed"] = random.randint(-(10 ** 10), 10 ** 10)

    try:
        async for part in await ollama_client.chat(model, messages, stream = True, options = options):
            token = part.message.content

            if type(token) == str:
                chat.pending_message.text += token
                if not await safe_save_message_text(chat.pending_message):
                    return
                await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_token", "token": token, "message_index": message_index})

            if str(chat.uuid) in opened_chats:
                opened_chats.discard(str(chat.uuid))
                await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": chat.pending_message.text, "message_index": message_index})
    except asyncio.CancelledError:
        chat.pending_message = None
        if not await safe_save_chat_pending_message(chat):
            return
        if should_generate_title:
            await generate_title(chat)
        return

    await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_message", "message": chat.pending_message.text, "message_index": message_index})

    if should_generate_title:
        await generate_title(chat)

    chat.pending_message = None
    if not await safe_save_chat_pending_message(chat):
        return

    await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_end"})

async def generate_title(chat: Chat):
    model, options = get_ollama_model_and_options(chat.pending_message.model)

    options["num_predict"] = 10
    if IS_PLAYWRIGHT_TEST:
        options["seed"] = 0

    first_message = await chat.messages.afirst()
    last_message = await chat.messages.alast()

    messages = [
        {
            "role": "user",
            "content": (
                "Generate a simple and concise title for the following conversation."
                f"\n\nUser:\n{first_message.text}\n\nAssistant:\n{last_message.text}"
            )
        }
    ]

    response = await ollama_client.chat(model, messages, options = options)

    content = response.message.content
    if type(content) == str:
        title = content.strip().replace("\n", " ")[:200]
        if title != "":
            chat.title = title
            await chat.asave(update_fields = ["title"])
            await channel_layer.group_send(f"chat_{str(chat.uuid)}", {"type": "send_title", "title": chat.title})

@database_sync_to_async
def get_messages(up_to_message: Message) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": get_system_prompt(up_to_message.chat.user)}]

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

def get_system_prompt(user: User):
    system_prompt = (
        "You are a helpful and nice AI personal assistant. "
        "Your role is to provide assistance to the user. "
        "Always answer the user concisely using one small phrase with simple words."
    )

    custom_instructions = user.preferences.custom_instructions
    nickname = user.preferences.nickname
    occupation = user.preferences.occupation
    about = user.preferences.about

    if any(map(lambda p: p != "", [custom_instructions, nickname, occupation, about])):
        system_prompt += f"\nIn addition, you should know the following:"

    if nickname != "":
        system_prompt += f"\nThe nickname of the user is: {nickname}"

    if occupation != "":
        system_prompt += f"\nThe user's occupation is: {occupation}"

    if about != "":
        system_prompt += f"\nThe user has the following to say about them:\n{about}"

    if custom_instructions != "":
        system_prompt += f"\nYou should follow these instructions:\n{custom_instructions}"

    return system_prompt

def stop_pending_chat(chat: Chat):
    if str(chat.uuid) in chat_futures:
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

def get_ollama_model_and_options(model: str):
    base_options = {"numa": True, "num_ctx": 512, "num_batch": 1, "logits_all": True, "use_mmap": True, "use_mlock": True, "num_predict": 256}

    match model:
        case "SmolLM2-135M":
            return "smollm2:135m-instruct-q2_K", base_options
        case "SmolLM2-360M":
            return "smollm2:360m-instruct-q2_K", base_options
        case "SmolLM2-1.7B":
            return "smollm2:1.7b-instruct-q2_K", base_options
        case "Moondream":
            return "moondream:1.8b-v2-q2_K", base_options

async def safe_save_message_text(message: Message):
    exists = await database_sync_to_async(Message.objects.filter(pk = message.pk).exists)()
    if not exists:
        return False
    await message.asave(update_fields = ["text"])
    return True

async def safe_save_chat_pending_message(chat: Chat):
    exists = await database_sync_to_async(Chat.objects.filter(pk = chat.pk).exists)()
    if not exists:
        return False
    await chat.asave(update_fields = ["pending_message"])
    return True

IS_PLAYWRIGHT_TEST = os.getenv("PLAYWRIGHT_TEST") == "True"

if IS_PLAYWRIGHT_TEST:
    test_seeds: dict[str, int] = {}

    def get_test_seed(chat: Chat):
        seed = test_seeds.get(str(chat.uuid), 0)
        if seed == 0:
            test_seeds[str(chat.uuid)] = 1
        else:
            test_seeds[str(chat.uuid)] += 1
        return seed

logger = logging.getLogger(__name__)

channel_layer = get_channel_layer()
ollama_client = ollama.AsyncClient("ollama")

def start_background_loop(loop: asyncio.AbstractEventLoop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

event_loop = asyncio.new_event_loop()
chat_futures: dict[str, asyncio.Future[None]] = {}
opened_chats: set[str] = set()

threading.Thread(target = start_background_loop, args = [event_loop], daemon = True).start()