from django.contrib import admin
from django.contrib.auth.models import Group

from .chat import ChatAdmin
from .message import MessageAdmin
from .user import UserAdmin, UserSessionAdmin
from ..models import Chat, Message, User, UserSession

admin.site.unregister(Group)

admin.site.register(User, UserAdmin)
admin.site.register(UserSession, UserSessionAdmin)
admin.site.register(Chat, ChatAdmin)
admin.site.register(Message, MessageAdmin)