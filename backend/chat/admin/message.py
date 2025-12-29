import logging

logger = logging.getLogger(__name__)

from django import forms
from django.contrib import admin
from django.contrib.admin.utils import display_for_field
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.safestring import mark_safe

from ..models import Message

class MessageForm(forms.ModelForm):
    class Meta:
        model = Message
        fields = "__all__"
        widgets = {
            "text": forms.Textarea(attrs = {
                "class": "chat-autoresize",
                "rows": "1",
                "wrap": "off",
                "style": "resize:none;overflow-x:auto;overflow-y:hidden;white-space:pre;box-sizing:border-box;width:100%;"
            })
        }

class MessageInline(admin.StackedInline):
    model = Message
    form = MessageForm
    fields = ("text", "files_display", "is_from_user", "model", "last_modified_at_display", "created_at_display")
    readonly_fields = ("files_display", "last_modified_at_display", "created_at_display")
    extra = 0
    show_change_link = True

    class Media:
        js = ("chat/js/autoresize.js",)

    def files_display(self, message: Message):
        if not message.pk:
            return ""

        files = message.files.all()
        if not files:
            return ""

        items = []
        for f in files:
            preview = "(binary content hidden)"
            try:
                data = f.content
                if isinstance(data, (bytes, bytearray)):
                    try:
                        text = data.decode("utf-8")
                        if all(ch.isprintable() or ch in "\n\r\t" for ch in text):
                            preview = "<pre>" + (text[:1000] + ("..." if len(text) > 1000 else "")) + "</pre>"
                    except UnicodeDecodeError:
                        preview = "(binary content hidden)"
            except Exception:
                preview = "(unable to read content)"

            items.append({
                "name": f.name,
                "content_type": f.content_type,
                "created_at": f.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "preview": preview,
            })

        rendered = render_to_string("chat/files_list.html", {"items": items})
        return mark_safe(rendered)

    files_display.short_description = "Files"

    def last_modified_at_display(self, message: Message):
        field = Message._meta.get_field("last_modified_at")
        return display_for_field(message.last_modified_at, field, "-")

    last_modified_at_display.short_description = "Last modified"

    def created_at_display(self, message: Message):
        field = Message._meta.get_field("created_at")
        return display_for_field(message.created_at, field, "-")

    created_at_display.short_description = "Created"

class MessageAdmin(admin.ModelAdmin):
    model = Message
    form = MessageForm
    readonly_fields = ("chat", "chat_title", "is_from_user", "model", "last_modified_at_display", "created_at_display", "files_display")
    fields = ("chat_title", "text", "files_display", "is_from_user", "model", "last_modified_at_display", "created_at_display")
    list_display = ("chat__title", "summary", "is_from_user", "model", "last_modified_at_display", "created_at_display")
    search_fields = ("chat__title", "text")
    ordering = ("-created_at",)

    class Media:
        js = ("chat/js/autoresize.js",)

    def chat_title(self, message: Message):
        if not message or not message.chat:
            return ""
        url = reverse("admin:chat_chat_change", args = [message.chat.pk])
        return mark_safe(f"<a href=\"{url}\">{message.chat.title}</a>")

    chat_title.short_description = "Chat"

    def files_display(self, message: Message):
        if not message.pk:
            return ""
        files = message.files.all()
        if not files:
            return ""
        items = []
        for f in files:
            preview = "(binary content hidden)"
            try:
                data = f.content
                if isinstance(data, (bytes, bytearray)):
                    try:
                        text = data.decode("utf-8")
                        if all(character.isprintable() or character in "\n\r\t" for character in text):
                            preview = "<pre>" + (text[:1000] + ("..." if len(text) > 1000 else "")) + "</pre>"
                    except UnicodeDecodeError:
                        preview = "(binary content hidden)"
            except Exception:
                preview = "(unable to read content)"
            items.append({
                "name": f.name,
                "content_type": f.content_type,
                "created_at": f.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "preview": preview,
            })
        rendered = render_to_string("chat/files_list.html", {"items": items})
        return mark_safe(rendered)

    files_display.short_description = "Files"

    def summary(self, message: Message):
        return message.text[:25] + ("..." if len(message.text) > 25 else "")

    def last_modified_at_display(self, message: Message):
        field = Message._meta.get_field("last_modified_at")
        return display_for_field(message.last_modified_at, field, "-")

    last_modified_at_display.short_description = "Last modified"

    def created_at_display(self, message: Message):
        field = Message._meta.get_field("created_at")
        return display_for_field(message.created_at, field, "-")

    created_at_display.short_description = "Created"