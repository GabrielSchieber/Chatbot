from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import GetMessage, GetMessages, LogoutView, RegisterView

urlpatterns = [
    path("signup/", RegisterView.as_view(), name = "signup"),
    path("login/", TokenObtainPairView.as_view(), name = "login"),
    path("logout/", LogoutView.as_view(), name = "logout"),
    path("refresh/", TokenRefreshView.as_view(), name = "token_refresh"),
    path("get-message/", GetMessage.as_view(), name = "get_message"),
    path("get-messages/", GetMessages.as_view(), name = "get_messages")
]