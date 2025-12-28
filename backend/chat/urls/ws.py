from django.urls import path

from ..consumers import ChatConsumer, GuestChatConsumer

websocket_urlpatterns = [
    path("ws/chat/", ChatConsumer.as_asgi()),
    path("ws/guest-chat/", GuestChatConsumer.as_asgi())
]