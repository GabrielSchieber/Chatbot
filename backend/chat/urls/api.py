import os

from django.urls import path

from ..views import chat, message, user

urlpatterns = [
    path("signup/", user.Signup.as_view()),
    path("verify-email/", user.VerifyEmail.as_view()),
    path("login/", user.Login.as_view()),
    path("logout/", user.Logout.as_view()),
    path("logout-all-sessions/", user.LogoutAllSessions.as_view()),
    path("setup-mfa/", user.SetupMFA.as_view()),
    path("enable-mfa/", user.EnableMFA.as_view()),
    path("disable-mfa/", user.DisableMFA.as_view()),
    path("verify-mfa/", user.VerifyMFA.as_view()),
    path("refresh/", user.Refresh.as_view()),
    path("me/", user.Me.as_view()),
    path("delete-account/", user.DeleteAccount.as_view()),
    path("request-password-reset/", user.RequestPasswordReset.as_view()),
    path("confirm-password-reset/", user.ConfirmPasswordReset.as_view()),
    path("authenticate-as-guest/", user.AuthenticateAsGuest.as_view()),

    path("get-chat/", chat.GetChat.as_view()),
    path("get-chats/", chat.GetChats.as_view()),
    path("search-chats/", chat.SearchChats.as_view()),
    path("rename-chat/", chat.RenameChat.as_view()),
    path("archive-chat/", chat.ArchiveChat.as_view()),
    path("unarchive-chat/", chat.UnarchiveChat.as_view()),
    path("delete-chat/", chat.DeleteChat.as_view()),
    path("archive-chats/", chat.ArchiveChats.as_view()),
    path("unarchive-chats/", chat.UnarchiveChats.as_view()),
    path("delete-chats/", chat.DeleteChats.as_view()),
    path("stop-pending-chats/", chat.StopPendingChats.as_view()),

    path("get-message-file-content/", message.GetMessageFileContent.as_view()),
    path("get-message-file-ids/", message.GetMessageFileIDs.as_view()),
    path("get-messages/", message.GetMessages.as_view()),
    path("new-message/", message.NewMessage.as_view()),
    path("edit-message/", message.EditMessage.as_view()),
    path("regenerate-message/", message.RegenerateMessage.as_view())
]

if os.environ.get("DJANGO_TEST") != "True":
    from ..tasks import schedule_deletion_of_temporary_chats
    schedule_deletion_of_temporary_chats()