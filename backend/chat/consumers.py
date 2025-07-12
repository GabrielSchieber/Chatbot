from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .sample import sample_model
from .utils import markdown_to_html

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        if self.user.is_anonymous:
            await self.close()
            return

        self.user_messages = []
        self.bot_messages = []
        await self.accept()

    async def receive_json(self, content):
        user_message = content["message"]
        self.user_messages.append(user_message)
        bot_message = ""

        messages = self.get_messages(user_message)

        async for token in sample_model(messages, 256):
            bot_message += token
            await self.send_json({"token": token})
        self.bot_messages.append(bot_message)

        await self.send_json({"message": {"markdown": bot_message, "html": markdown_to_html(bot_message)}})

    def get_messages(self, new_user_message: str):
        messages = []
        for user_message, bot_message in zip(self.user_messages, self.bot_messages):
            messages.extend([
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": bot_message}
            ])
        messages.append({"role": "user", "content": new_user_message})
        return messages