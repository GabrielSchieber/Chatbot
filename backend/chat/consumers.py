import ollama
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.messages: list[dict[str, str]] = []
        await self.accept()

    async def receive_json(self, content):
        if type(content) != dict:
            return await self.close()

        user_message = content.get("message")
        if type(user_message) != str:
            return await self.close()
        if len(user_message) > 10000:
            return await self.close()

        self.messages.append({"role": "user", "content": user_message})

        bot_message = ""
        async for part in await ollama.AsyncClient().chat("smollm2:135m-instruct-fp16", self.messages, stream = True):
            token = part.message.content
            if type(token) == str:
                bot_message += token
                await self.send_json({"token": token})

        self.messages.append({"role": "assistant", "content": bot_message})

        await self.send_json({"message": bot_message})

        self.messages = self.messages[max(len(self.messages) - 20, 0):]