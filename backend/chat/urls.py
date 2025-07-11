from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import LogoutView, RegisterView

urlpatterns = [
    path("signup/", RegisterView.as_view(), name = "signup"),
    path("login/", TokenObtainPairView.as_view(), name = "login"),
    path("logout/", LogoutView.as_view(), name = "logout"),
    path("refresh/", TokenRefreshView.as_view(), name = "token_refresh")
]