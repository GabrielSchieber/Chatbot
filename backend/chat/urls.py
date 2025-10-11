from django.conf import settings
from django.urls import path, re_path

from .views import (
    DeleteAccount,
    DeleteChat,
    DeleteChats,
    DisableMFA,
    EditMessage,
    EnableMFA,
    GetChats,
    GetMessageFileContent,
    GetMessages,
    Login,
    Logout,
    Me,
    NewMessage,
    Refresh,
    RegenerateMessage,
    RenameChat,
    SearchChats,
    SetupMFA,
    Signup,
    StopPendingChats,
    VerifyMFA,
    index
)

urlpatterns = [
    path("api/signup/", Signup.as_view()),
    path("api/login/", Login.as_view()),
    path("api/mfa/verify/", VerifyMFA.as_view()),
    path("api/logout/", Logout.as_view()),
    path("api/me/", Me.as_view()),
    path("api/refresh/", Refresh.as_view()),
    path("api/mfa/setup/", SetupMFA.as_view()),
    path("api/mfa/enable/", EnableMFA.as_view()),
    path("api/mfa/disable/", DisableMFA.as_view()),
    path("api/delete-account/", DeleteAccount.as_view()),
    path("api/get-chats/", GetChats.as_view()),
    path("api/search-chats/", SearchChats.as_view()),
    path("api/rename-chat/", RenameChat.as_view()),
    path("api/delete-chat/", DeleteChat.as_view()),
    path("api/delete-chats/", DeleteChats.as_view()),
    path("api/stop-pending-chats/", StopPendingChats.as_view()),
    path("api/get-message-file-content/", GetMessageFileContent.as_view()),
    path("api/get-messages/", GetMessages.as_view()),
    path("api/new-message/", NewMessage.as_view()),
    path("api/edit-message/", EditMessage.as_view()),
    path("api/regenerate-message/", RegenerateMessage.as_view())
]

if not settings.DEBUG:
    urlpatterns.append(re_path(".*", index))