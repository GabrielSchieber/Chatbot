import ollama
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.messages: list[dict[str, str]] = []
        await self.accept()

    async def receive_json(self, content):
        if type(content) != dict:
            return await self.close(1003)

        user_message = content.get("message")
        if type(user_message) != str:
            return await self.close(1003)

        self.messages.append({"role": "user", "content": user_message})

        bot_message = ""
        async for part in await ollama.AsyncClient().chat("smollm2:135m-instruct-fp16", self.messages, stream = True):
            token = part["message"]["content"]
            bot_message += token
            await self.send_json({"token": token})

        self.messages.append({"role": "assistant", "content": bot_message})

        await self.send_json({"message": bot_message})