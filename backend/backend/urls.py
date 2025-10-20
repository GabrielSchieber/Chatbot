import os

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from chat.views import index

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("chat.urls"))
]

if settings.DEBUG and os.getenv("PLAYWRIGHT_TEST") == "True":
    urlpatterns.append(path("test/", include("chat.urls_test")))

if not settings.DEBUG:
    urlpatterns.append(re_path(".*", index))