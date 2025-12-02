import os

if os.getenv("DJANGO_TEST") != "True" and os.getenv("PLAYWRIGHT_TEST") != "True":
    raise RuntimeError("DJANGO_TEST or PLAYWRIGHT_TEST environment variable must be 'True' for using test urls.")

from django.urls import path

from . import views_test

urlpatterns = [
    path("create-chats/", views_test.CreateChats.as_view()),
    path("get-mfa-secret/", views_test.GetMFASecret.as_view()),
    path("echo-auth/", views_test.EchoAuthHeaderView.as_view())
]