import asyncio
import time
import uuid
from typing import Any, Iterable

import pytest
from asgiref.sync import sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from .utils import create_user
from ..consumers import ChatConsumer
from ..models import User
from ..tasks import opened_chats

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_reject_unauthenticated_connection():
    ws = get_communicator()
    connected, subprotocol = await ws.connect()
    assert connected is False
    assert subprotocol == 401

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_reject_connection_with_tampered_cookie(db):
    user = await sync_to_async(create_user)()
    cookie = get_access_cookie_for_user(user)
    cookie = cookie[:-1] + ("A" if cookie[-1] != "A" else "B")

    ws = get_communicator([(b"cookie", cookie.encode())])
    connected, subprotocol = await ws.connect()
    assert connected is False
    assert subprotocol == 401

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_accept_authenticated_connection(db):
    _, ws = await connect_to_communicator_with_user()
    await ws.disconnect()

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_join_chat_group(db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    await ws.disconnect()

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_receive_send_message_event(db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(f"chat_{chat.uuid}", {"type": "send_message", "message": "Hello World!", "message_index": 0})

    response = await ws.receive_json_from()
    assert response == {"message": "Hello World!", "message_index": 0}

    await ws.disconnect()

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_disconnect_removes_opened_chat(db):
    user, ws = await connect_to_communicator_with_user()
    chat = await user.chats.acreate(title = "Chat")

    await ws.send_json_to({"chat_uuid": str(chat.uuid)})
    await assert_in(str(chat.uuid), opened_chats)

    await ws.disconnect()
    await assert_not_in(str(chat.uuid), opened_chats)

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_sending_str_closes_connection(db):
    _, ws = await connect_to_communicator_with_user()
    await ws.send_json_to("not a dict")
    output = await ws.receive_output()
    assert output["type"] == "websocket.close"
    await ws.disconnect()

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_sending_invalid_dict_closes_connection(db):
    _, ws = await connect_to_communicator_with_user()
    await ws.send_json_to({"chat_uuid": 123})
    output = await ws.receive_output()
    assert output["type"] == "websocket.close"
    await ws.disconnect()

@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_sending_invalid_chat_uuid_keeps_connection(db):
    _, ws = await connect_to_communicator_with_user()
    await ws.send_json_to({"chat_uuid": str(uuid.uuid4())})
    assert await ws.receive_nothing(1, 0.05)
    await ws.disconnect()

def get_access_cookie_for_user(user: User):
    return f"access_token={AccessToken.for_user(user)}"

def get_communicator(headers = None):
    return WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/", headers)

def get_communicator_with_cookie(user: User):
    return get_communicator([(b"cookie", get_access_cookie_for_user(user).encode())])

async def connect_to_communicator_with_user():
    user = await sync_to_async(create_user)()
    ws = get_communicator_with_cookie(user)
    connected, subprotocol = await ws.connect()
    assert connected is True
    assert subprotocol is None
    return user, ws

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