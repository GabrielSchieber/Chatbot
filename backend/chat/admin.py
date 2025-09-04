from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group

from .models import Chat, Message, MessageFile, User

admin.site.unregister(Group)

class UserAdmin(BaseUserAdmin):
    model = User
    list_display = ["email", "is_staff", "is_active"]
    list_filter = ["email", "is_staff", "is_active"]
    ordering = ["email"]
    search_fields = ["email"]

    fieldsets = (
        (None, {"fields": ["email", "password", "theme", "has_sidebar_open"]}),
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
    extra = 0
    can_delete = False
    readonly_fields = ["message_files_summary"]
    fields = ["text", "role", "message_files_summary", "model", "created_at"]

    def has_add_permission(self, request, obj):
        return False

    def has_delete_permission(self, request, obj = None):
        return False

    def has_change_permission(self, request, obj = None):
        return True

    def get_readonly_fields(self, request, obj = None):
        base_fields = [f.name for f in self.model._meta.fields]
        return base_fields + ["message_files_summary"]

    def message_files_summary(self, messages: Message):
        if not messages.pk:
            return "-"
        files: list[MessageFile] = messages.files.all()
        if not files:
            return "No files"
        return "\n\n\n".join(f"{f.name}\n{f.content.decode(errors = "ignore")}" for f in files)

    message_files_summary.short_description = "Files"

class ChatAdmin(admin.ModelAdmin):
    inlines = [MessageInline]
    list_display = ["user", "uuid", "title", "created_at"]

    def get_readonly_fields(self, request, obj = None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj = None):
        return True

admin.site.register(Chat, ChatAdmin)