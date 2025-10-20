import os

from django.conf import settings
from django.urls import path

if not settings.DEBUG or os.getenv("PLAYWRIGHT_TEST") != "True":
    raise Exception("Django DEBUG and PLAYWRIGHT_TEST variables must be both True for using test urls.")

from . import views_test

urlpatterns =[
    path("create-chats/", views_test.CreateChats.as_view()),
    path("get-mfa-secret/", views_test.GetMFASecret.as_view())
]