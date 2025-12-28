import os

if os.getenv("DJANGO_TEST") != "True" and os.getenv("PLAYWRIGHT_TEST") != "True":
    raise RuntimeError("DJANGO_TEST or PLAYWRIGHT_TEST environment variable must be 'True' for using test urls.")

from django.urls import path

from ..views import test

urlpatterns = [
    path("create-chat/", test.CreateChat.as_view()),
    path("create-chats/", test.CreateChats.as_view()),
    path("get-mfa-secret/", test.GetMFASecret.as_view()),
    path("echo-auth/", test.EchoAuthHeaderView.as_view())
]