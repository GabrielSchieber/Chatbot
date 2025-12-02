import os

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("chat.urls"))
]

if os.getenv("DJANGO_TEST") == "True" or os.getenv("PLAYWRIGHT_TEST") == "True":
    urlpatterns.append(path("test/", include("chat.urls_test")))