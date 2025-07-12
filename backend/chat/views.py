from rest_framework import generics, serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import Chat, Message, User
from .utils import markdown_to_html

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only = True)

    class Meta:
        model = User
        fields = ["email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(email = validated_data["email"], password = validated_data["password"])

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

class LogoutView(APIView):
    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status = 205)
        except Exception:
            return Response(status = 400)

class GetMessage(APIView):
    def post(self, request):
        try:
            user = get_user_from_token(request.data["access_token"])
            chat_uuid = request.data["chat_uuid"]
            message_index = request.data["message_index"]
            chat = Chat.objects.get(user = user, uuid = chat_uuid)
            message = Message.objects.filter(chat = chat)[message_index]
            return Response({"text": message.text})
        except Exception:
            return Response(status = 400)

class GetMessages(APIView):
    def post(self, request):
        try:
            user = get_user_from_token(request.data["access_token"])
            chat_uuid = request.data["chat_uuid"]
            chat = Chat.objects.get(user = user, uuid = chat_uuid)
            messages = [m.text if m.is_user_message else markdown_to_html(m.text) for m in Message.objects.filter(chat = chat)]                
            return Response({"messages": messages})
        except Exception:
            return Response(status = 400)

def get_user_from_token(token: str) -> User:
    access_token = AccessToken(token)
    return User.objects.get(id = access_token["user_id"])