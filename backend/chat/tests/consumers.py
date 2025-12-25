import asyncio
import time
import uuid
from datetime import datetime
from typing import Any, Iterable

import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from freezegun import freeze_time
from rest_framework_simplejwt.tokens import AccessToken

from .utils import create_user
from ..consumers import ChatConsumer, GuestChatConsumer, RedisTokenBucket
from ..models import User
from ..tasks import ollama_client, opened_chats, generate_message

@pytest.mark.asyncio
async def test_reject_unauthenticated_connection():
    ws = get_communicator()
    connected, subprotocol = await ws.connect()
    assert connected is False
    assert subprotocol == 401

@pytest.mark.asyncio
async def test_reject_connection_with_tampered_cookie(transactional_db):
    user = await database_sync_to_async(create_user)()
    cookie = get_access_cookie_for_user(user)
    cookie = cookie[:-1] + ("A" if cookie[-1] != "A" else "B")

    ws = get_communicator([(b"cookie", cookie.encode())])
    connected, subprotocol = await ws.connect()
    assert connected is False
    assert subprotocol == 401

@pytest.mark.asyncio
async def test_reject_connection_with_expired_cookie(transactional_db):
    time_to_freeze = datetime(2025, 1, 1, 12)
    with freeze_time(time_to_freeze):
        user = await database_sync_to_async(create_user)()
        cookie = AccessToken.for_user(user)

    with freeze_time(time_to_freeze + cookie.lifetime):
        ws = get_communicator([(b"cookie", f"access_token={cookie}".encode())])
        connected, subprotocol = await ws.connect()
        assert connected is False
        assert subprotocol == 401

@pytest.mark.asyncio
async def test_accept_authenticated_connection(transactional_db):
    _, ws = await connect_to_communicator_with_user()
    await ws.disconnect()

@pytest.mark.asyncio
async def test_join_chat_group(transactional_db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    await ws.disconnect()

@pytest.mark.asyncio
async def test_receive_send_token_event(transactional_db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(f"chat_{chat.uuid}", {"type": "send_token", "token": "Hello", "message_index": 0})

    response = await ws.receive_json_from()
    assert response == {"token": "Hello", "message_index": 0}

    await ws.disconnect()

@pytest.mark.asyncio
async def test_receive_send_message_event(transactional_db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(f"chat_{chat.uuid}", {"type": "send_message", "message": "Hello World!", "message_index": 0})

    response = await ws.receive_json_from()
    assert response == {"message": "Hello World!", "message_index": 0}

    await ws.disconnect()

@pytest.mark.asyncio
async def test_receive_send_title_event(transactional_db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(f"chat_{chat.uuid}", {"type": "send_title", "title": "Some Chat"})

    response = await ws.receive_json_from()
    assert response == {"title": "Some Chat"}

    await ws.disconnect()

@pytest.mark.asyncio
async def test_receive_send_end_event(transactional_db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(f"chat_{chat.uuid}", {"type": "send_end"})

    response = await ws.receive_json_from()
    assert response == "end"

    await ws.disconnect()

@pytest.mark.asyncio
async def test_generate_message_streaming(transactional_db, monkeypatch):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat", is_temporary = True)

    pending = await chat.messages.acreate(text = "", is_from_user = False, model = "SmolLM2-135M")
    chat.pending_message = pending
    await chat.asave(update_fields = ["pending_message"])

    async def fake_chat(model, messages, stream = True, options = None):
        async def gen():
            class Part:
                def __init__(self, text):
                    self.message = type("M", (), {"content": text})

            for t in ["Hello", " world"]:
                await asyncio.sleep(0.01)
                yield Part(t)

        return gen()

    monkeypatch.setattr(ollama_client, "chat", fake_chat)

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    await generate_message(chat, False, False)

    received_tokens = []
    final_message = None

    while True:
        response = await ws.receive_json_from()
        if response == "end":
            break
        if isinstance(response, dict) and response.get("token"):
            received_tokens.append(response.get("token"))
        if isinstance(response, dict) and response.get("message"):
            final_message = response.get("message")

    assembled = "".join(received_tokens)
    result_text = final_message if final_message is not None else assembled
    assert result_text == "Hello world"

    await ws.disconnect()

@pytest.mark.asyncio
async def test_disconnect_removes_opened_chat(transactional_db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    await ws.disconnect()
    await assert_not_in(str(chat.uuid), opened_chats)

@pytest.mark.asyncio
async def test_sending_str_closes_connection(transactional_db):
    _, ws = await connect_to_communicator_with_user()
    await ws.send_json_to("not a dict")
    output = await ws.receive_output()
    assert output["type"] == "websocket.close"
    await ws.disconnect()

@pytest.mark.asyncio
async def test_sending_invalid_dict_closes_connection(transactional_db):
    _, ws = await connect_to_communicator_with_user()
    await ws.send_json_to({"chat_uuid": 123})
    output = await ws.receive_output()
    assert output["type"] == "websocket.close"
    await ws.disconnect()

@pytest.mark.asyncio
async def test_sending_invalid_chat_uuid_keeps_connection(transactional_db):
    _, ws = await connect_to_communicator_with_user()
    await ws.send_json_to({"chat_uuid": str(uuid.uuid4())})
    assert await ws.receive_nothing(1, 0.05)
    await ws.disconnect()

@pytest.mark.asyncio
async def test_rate_limited(transactional_db, monkeypatch):
    async def fake_allow(self, key, requested = 1):
        return False, 3.5

    monkeypatch.setattr(RedisTokenBucket, "allow", fake_allow)

    user, ws = await connect_to_communicator_with_user()
    await ws.send_json_to({"chat_uuid": str(uuid.uuid4())})
    response = await ws.receive_json_from()
    assert response == {"error": "rate_limited", "retry_after": 3.5}
    await ws.disconnect()

def get_access_cookie_for_user(user: User):
    return f"access_token={AccessToken.for_user(user)}"

def get_communicator(headers = None):
    return WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/", headers)

def get_guest_communicator():
    return WebsocketCommunicator(GuestChatConsumer.as_asgi(), "/ws/guest-chat/")

def get_communicator_with_cookie(user: User):
    return get_communicator([(b"cookie", get_access_cookie_for_user(user).encode())])

async def connect_to_communicator_with_user():
    user = await database_sync_to_async(create_user)()
    ws = get_communicator_with_cookie(user)
    connected, subprotocol = await ws.connect()
    assert connected is True
    assert subprotocol is None
    return user, ws

async def connect_to_communicator_as_guest():
    ws = get_guest_communicator()
    connected, subprotocol = await ws.connect()
    assert connected is True
    assert subprotocol is None
    return ws

async def assert_in(value: Any, container: Iterable[Any], timeout: float = 1, interval: float = 0.05):
    start = time.time()
    while time.time() - start < timeout:
        if value in container:
            return
        await asyncio.sleep(interval)
    raise AssertionError(f"The value '{value}' was not found in the container '{container}'")

async def assert_not_in(value: Any, container: Iterable[Any], timeout: float = 1, interval: float = 0.05):
    start = time.time()
    while time.time() - start < timeout:
        if value not in container:
            return
        await asyncio.sleep(interval)
    raise AssertionError(f"The value '{value}' was found in the container '{container}'")

@pytest.mark.asyncio
async def test_guest_accept_connection():
    ws = await connect_to_communicator_as_guest()
    await ws.disconnect()

@pytest.mark.asyncio
async def test_guest_sending_str_closes_connection():
    ws = await connect_to_communicator_as_guest()
    await ws.send_json_to("not a dict")
    output = await ws.receive_output()
    assert output["type"] == "websocket.close"
    await ws.disconnect()

@pytest.mark.asyncio
async def test_guest_rate_limited(monkeypatch):
    async def fake_allow(self, key, requested=1):
        return False, 3.5

    monkeypatch.setattr(RedisTokenBucket, "allow", fake_allow)

    ws = WebsocketCommunicator(GuestChatConsumer.as_asgi(), "/ws/guest/")
    await ws.connect()
    await ws.send_json_to({"text": "Hi"})
    response = await ws.receive_json_from()
    assert response == {"error": "rate_limited", "retry_after": 3.5}
    await ws.disconnect()

@pytest.mark.asyncio
async def test_guest_generate_message_streaming(monkeypatch):
    async def fake_chat(model, messages, stream=True, options=None):
        async def gen():
            class Part:
                def __init__(self, text):
                    self.message = type("M", (), {"content": text})

            for t in ["Hello", " world"]:
                await asyncio.sleep(0.01)
                yield Part(t)

        return gen()

    monkeypatch.setattr(ollama_client, "chat", fake_chat)

    ws = WebsocketCommunicator(GuestChatConsumer.as_asgi(), "/ws/guest/")
    await ws.connect()
    await ws.send_json_to({"text": "Hi"})

    resp1 = await ws.receive_json_from()
    assert resp1 == {"token": "Hello", "message_index": 1}

    resp2 = await ws.receive_json_from()
    assert resp2 == {"token": " world", "message_index": 1}

    resp3 = await ws.receive_json_from()
    assert resp3 == {"message": "Hello world", "message_index": 1}

    resp4 = await ws.receive_json_from()
    assert resp4 == "end"

    await ws.disconnect()

@pytest.mark.asyncio
async def test_guest_stop_cancels_task_and_allows_new_one(monkeypatch):
    async def fake_chat(model, messages, stream=True, options=None):
        async def gen():
            class Part:
                def __init__(self, text):
                    self.message = type("M", (), {"content": text})

            for t in ["a", "b", "c"]:
                await asyncio.sleep(0.1)
                yield Part(t)

        return gen()

    monkeypatch.setattr(ollama_client, "chat", fake_chat)

    ws = WebsocketCommunicator(GuestChatConsumer.as_asgi(), "/ws/guest/")
    await ws.connect()

    await ws.send_json_to({"text": "first"})
    await asyncio.sleep(0.02)

    await ws.send_json_to("stop")

    await ws.send_json_to({"text": "second"})
    resp = await ws.receive_json_from()
    assert resp.get("token") in ("a", "b", "c")

    await ws.disconnect()

@pytest.mark.asyncio
async def test_guest_sending_invalid_model_closes_connection():
    ws = await connect_to_communicator_as_guest()

    for model in ["invalid", None, False, True, -123, 0, 123, -1.23, 0.0, 1.23, [], {}]:
        await ws.send_json_to({"text": "Hi", "model": model})
        output = await ws.receive_output()
        assert output["type"] == "websocket.close"

    await ws.disconnect()