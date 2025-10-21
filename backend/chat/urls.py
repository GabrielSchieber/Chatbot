from django.urls import path

from . import views

urlpatterns = [
    path("signup/", views.Signup.as_view()),
    path("login/", views.Login.as_view()),
    path("verify-mfa/", views.VerifyMFA.as_view()),
    path("logout/", views.Logout.as_view()),
    path("me/", views.Me.as_view()),
    path("refresh/", views.Refresh.as_view()),
    path("setup-mfa/", views.SetupMFA.as_view()),
    path("enable-mfa/", views.EnableMFA.as_view()),
    path("disable-mfa/", views.DisableMFA.as_view()),
    path("delete-account/", views.DeleteAccount.as_view()),
    path("get-chat/", views.GetChat.as_view()),
    path("get-chats/", views.GetChats.as_view()),
    path("search-chats/", views.SearchChats.as_view()),
    path("rename-chat/", views.RenameChat.as_view()),
    path("archive-or-unarchive-chat/", views.ArchiveOrUnarchiveChat.as_view()),
    path("delete-chat/", views.DeleteChat.as_view()),
    path("delete-chats/", views.DeleteChats.as_view()),
    path("stop-pending-chats/", views.StopPendingChats.as_view()),
    path("get-message-file-content/", views.GetMessageFileContent.as_view()),
    path("get-messages/", views.GetMessages.as_view()),
    path("new-message/", views.NewMessage.as_view()),
    path("edit-message/", views.EditMessage.as_view()),
    path("regenerate-message/", views.RegenerateMessage.as_view())
]