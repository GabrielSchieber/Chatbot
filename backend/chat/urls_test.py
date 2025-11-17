import os

from django.urls import path

if os.getenv("PLAYWRIGHT_TEST") != "True":
    raise RuntimeError("PLAYWRIGHT_TEST environment variable must be True for using test urls.")

from . import views_test

urlpatterns = [
    path("create-chats/", views_test.CreateChats.as_view()),
    path("get-mfa-secret/", views_test.GetMFASecret.as_view())
]