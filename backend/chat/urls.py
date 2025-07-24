from django.urls import path, re_path

from .views import (
    DeleteAccount,
    DeleteChat,
    DeleteChats,
    GetChats,
    GetGeneratingChats,
    GetMessage,
    GetMessages,
    SearchChats,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    RenameChat,
    index
)

urlpatterns = [
    path("api/signup/", RegisterView.as_view()),
    path("api/login/", LoginView.as_view()),
    path("api/logout/", LogoutView.as_view()),
    path("api/me/", MeView.as_view()),
    path("api/get-message/", GetMessage.as_view()),
    path("api/get-messages/", GetMessages.as_view()),
    path("api/get-chats/", GetChats.as_view()),
    path("api/get-generating-chats/", GetGeneratingChats.as_view()),
    path("api/search-chats/", SearchChats.as_view()),
    path("api/rename-chat/", RenameChat.as_view()),
    path("api/delete-chat/", DeleteChat.as_view()),
    path("api/delete-chats/", DeleteChats.as_view()),
    path("api/delete-account/", DeleteAccount.as_view()),
    re_path(".*", index)
]