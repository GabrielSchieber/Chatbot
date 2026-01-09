import logging

logger = logging.getLogger(__name__)

from django.contrib import admin, messages
from django.contrib.admin.utils import display_for_field
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import render_to_string
from django.urls import path, reverse
from django.utils.safestring import mark_safe

from .message import MessageInline
from ..models import Chat
from ..tasks import stop_pending_chat

class ChatAdmin(admin.ModelAdmin):
    model = Chat
    inlines = (MessageInline,)

    class Media:
        css = {"all": ("chat/css/admin_pending_message.css",)}
        js = ("chat/js/admin_pending.js",)

    readonly_fields = ("user_link", "display_uuid", "pending_message_display", "created_at_display")
    fieldsets = (
        (None, {"fields": ("user_link", "display_uuid", "title", "pending_message_display", "is_archived", "is_temporary", "created_at_display")} ),
    )
    list_display = ("title", "uuid", "user_link", "is_pending", "is_archived_display", "is_temporary_display", "created_at_display")
    search_fields = ("title", "user__email")
    ordering = ("-created_at",)

    def user_link(self, chat: Chat):
        if not chat.user:
            return ""
        url = f"/admin/chat/user/{chat.user.pk}/change/"
        return mark_safe(f"<a href=\"{url}\">{chat.user.email}</a>")

    user_link.short_description = "User"
    user_link.admin_order_field = "user__email"

    def display_uuid(self, obj):
        return str(obj.uuid) if obj and obj.pk is not None else ""

    display_uuid.short_description = "UUID"

    def pending_message_display(self, chat: Chat):
        if not chat.pending_message:
            return ""
        message_pk = chat.pending_message.pk
        message_url = f"/admin/chat/message/{message_pk}/change/"
        stop_url = reverse("admin:chat_chat_stop_pending", args = [chat.pk])
        return mark_safe(render_to_string("chat/pending_message_display.html", {"message_url": message_url, "stop_url": stop_url, "message_pk": message_pk}))

    pending_message_display.short_description = "Pending message"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("<path:object_id>/stop-pending/", self.admin_site.admin_view(self.stop_pending_view), name="chat_chat_stop_pending"),
        ]
        return custom_urls + urls

    def stop_pending_view(self, request, object_id, *args, **kwargs):
        chat = get_object_or_404(Chat, pk = object_id)
        if request.method != "POST":
            messages.error(request, "Invalid request method.")
            return redirect(reverse("admin:chat_chat_change", args=[chat.pk]))

        try:
            stop_pending_chat(chat)
            messages.success(request, "Pending message generation stopped.")
        except Exception:
            logger.exception("Error stopping pending chat")
            messages.error(request, "Failed to stop pending message generation.")

        return redirect(reverse("admin:chat_chat_change", args = [chat.pk]))

    def is_pending(self, chat: Chat):
        return chat.pending_message is not None

    is_pending.short_description = "Pending"
    is_pending.boolean = True

    def is_archived_display(self, chat: Chat):
        return chat.is_archived

    is_archived_display.short_description = "Archived"
    is_archived_display.boolean = True

    def is_temporary_display(self, chat: Chat):
        return chat.is_temporary

    is_temporary_display.short_description = "Temporary"
    is_temporary_display.boolean = True

    def created_at_display(self, chat: Chat):
        field = Chat._meta.get_field("created_at")
        return display_for_field(chat.created_at, field, "-")

    created_at_display.short_description = "Created"