import os

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("chat.urls.api")),
    path("api/schema/", SpectacularAPIView.as_view(), name = "schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name = "schema"), name = "swagger-ui"),
    path("api/schema/redoc/", SpectacularRedocView.as_view(url_name = "schema"), name = "redoc")
]

if os.getenv("DJANGO_TEST") == "True" or os.getenv("PLAYWRIGHT_TEST") == "True":
    urlpatterns.append(path("test/", include("chat.urls.test")))