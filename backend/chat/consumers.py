import logging
import os
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from jwt import decode as jwt_decode
from redis import asyncio as aioredis

from .models import User
from .tasks import astop_pending_chat, opened_chats

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.redis_limiter = RedisTokenBucket("rate:user", 20, 60.0)

        self.user: User = await self.get_user_from_cookie()
        self.chat_uuid = ""

        if self.user is None or isinstance(self.user, AnonymousUser):
            return await self.close(401, "User not authenticated.")

        await self.accept()

    async def disconnect(self, code):
        if self.chat_uuid != "":
            opened_chats.discard(self.chat_uuid)
            await self.channel_layer.group_discard(f"chat_{self.chat_uuid}", self.channel_name)

            chat = await database_sync_to_async(self.user.chats.filter(uuid = self.chat_uuid, is_temporary = True).first)()
            if chat is not None:
                await astop_pending_chat(chat)
                await chat.adelete()

    async def receive_json(self, content):
        allowed, retry_after = await self.redis_limiter.allow(str(getattr(self.user, "id", "anon")))
        if not allowed:
            await self.send_json({"error": "rate_limited", "retry_after": retry_after})
            return

        if self.chat_uuid != "": return

        if type(content) != dict:
            return await self.close()

        chat_uuid = content.get("chat_uuid")
        if type(chat_uuid) != str:
            return await self.close()

        if await database_sync_to_async(self.user.chats.filter(uuid = chat_uuid).exists)():
            self.chat_uuid = chat_uuid
            await self.channel_layer.group_add(f"chat_{chat_uuid}", self.channel_name)
            opened_chats.add(chat_uuid)

    async def send_token(self, event):
        await self.send_json({"token": event["token"], "message_index": event["message_index"]})

    async def send_message(self, event):
        await self.send_json({"message": event["message"], "message_index": event["message_index"]})

    async def send_title(self, event):
        await self.send_json({"title": event["title"]})

    async def send_end(self, event):
        await self.send_json("end")

    async def get_user_from_cookie(self):
        try:
            raw_cookie = self.scope["headers"]
            cookie_dict = {}
            for header, value in raw_cookie:
                if header == b"cookie":
                    cookies = value.decode().split(";")
                    for cookie in cookies:
                        if "=" in cookie:
                            k, v = cookie.strip().split("=", 1)
                            cookie_dict[k] = v

            token = cookie_dict.get("access_token")
            if not token:
                return AnonymousUser()

            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms = ["HS256"])
            user_id = decoded_data.get("user_id")
            return await User.objects.aget(id = user_id)
        except Exception:
            return AnonymousUser()

_TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_per_sec = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local delta = math.max(0, now - ts)
local filled = delta * refill_per_sec
tokens = math.min(capacity, tokens + filled)

if tokens >= requested then
  tokens = tokens - requested
  redis.call("HMSET", key, "tokens", tostring(tokens), "ts", tostring(now))
  redis.call("EXPIRE", key, math.ceil(math.max(60, capacity / refill_per_sec * 2)))
  return {1, tostring(tokens)}
else
  local need = (requested - tokens) / refill_per_sec
  return {0, tostring(need)}
end
"""

_redis = None
async def get_redis():
    global _redis
    if _redis is None:
        url = getattr(settings, "REDIS_URL", None)
        if not url:
            url = os.environ.get("REDIS_URL")
        if not url and getattr(settings, "CACHES", None):
            loc = settings.CACHES.get("default", {}).get("LOCATION")
            if isinstance(loc, str) and loc.startswith("redis"):
                url = loc
        if not url:
            url = "redis://redis:6379/0"

        try:
            _redis = aioredis.from_url(url, encoding = "utf-8", decode_responses = True)
            await _redis.ping()
        except Exception as e:
            logging.warning("Redis not available (%s). Rate limiter disabled (fail-open).", e)
            class _DummyRedis:
                async def eval(self, *args, **kwargs):
                    return ["1", "0"]
            _redis = _DummyRedis()
    return _redis

class RedisTokenBucket:
    def __init__(self, key_prefix: str, capacity: int, period: float):
        self.key_prefix = key_prefix
        self.capacity = float(capacity)
        self.refill_per_sec = float(capacity) / float(period)

    async def allow(self, key_id: str, requested: int = 1):
        if os.environ.get("DJANGO_TEST") == "True":
            return True, 0.0

        redis = await get_redis()
        key = f"{self.key_prefix}:{key_id}"
        now = time.time()
        res = await redis.eval(_TOKEN_BUCKET_LUA, 1, key, str(now), str(self.capacity), str(self.refill_per_sec), str(requested))
        allowed = str(res[0]) == "1"
        val = float(res[1])
        if allowed:
            return True, 0.0
        else:
            return False, val