from django.urls import path

from .views import GetChats, GetMessage, GetMessages, LoginView, LogoutView, MeView, RegisterView

urlpatterns = [
    path("signup/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path("get-message/", GetMessage.as_view()),
    path("get-messages/", GetMessages.as_view()),
    path("get-chats/", GetChats.as_view())
]