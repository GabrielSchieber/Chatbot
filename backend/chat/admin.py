from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group

from .models import Chat, Message, User

admin.site.unregister(Group)

class UserAdmin(BaseUserAdmin):
    model = User
    list_display = ["email", "is_staff", "is_active"]
    list_filter = ["email", "is_staff", "is_active"]
    ordering = ["email"]
    search_fields = ["email"]

    fieldsets = (
        (None, {"fields": ["email", "password"]}),
        (
            "Permissions",
            {
                "fields": [
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions"
                ]
            }
        ),
        ("Important dates", {"fields": ["last_login"]})
    )

admin.site.register(User, UserAdmin)

class MessageInline(admin.StackedInline):
    model = Message

class ChatAdmin(admin.ModelAdmin):
    inlines = [MessageInline]
    list_display = ["user", "title", "is_complete", "date_time", "uuid"]

admin.site.register(Chat, ChatAdmin)