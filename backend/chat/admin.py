from django.contrib import admin

from .models import Chat, Message, MessageFile, User, UserMFA, UserPreferences

admin.site.register(Chat)
admin.site.register(Message)
admin.site.register(MessageFile)
admin.site.register(User)
admin.site.register(UserMFA)
admin.site.register(UserPreferences)