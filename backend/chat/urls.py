from django.urls import path

from .views import DeleteChat, GetChats, GetMessage, GetMessages, LoginView, LogoutView, MeView, RegisterView, RenameChat

urlpatterns = [
    path("signup/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("get-message/", GetMessage.as_view()),
    path("get-messages/", GetMessages.as_view()),
    path("get-chats/", GetChats.as_view()),
    path("rename-chat/", RenameChat.as_view()),
    path("delete-chat/", DeleteChat.as_view())
]