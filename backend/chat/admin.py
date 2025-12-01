import binascii
import logging

logger = logging.getLogger(__name__)

from django import forms
from django.contrib import admin, messages
from django.contrib.admin.utils import display_for_field
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, ReadOnlyPasswordHashField, AdminPasswordChangeForm
from django.contrib.auth.models import Group
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import render_to_string
from django.urls import path, reverse
from django.utils.safestring import mark_safe
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import Chat, Message, User, UserMFA, UserPreferences, UserSession
from .tasks import stop_pending_chat

class AdminPasswordChangeFormWithMinLength(AdminPasswordChangeForm):
    def clean(self):
        cleaned = super().clean()
        pw = cleaned.get("new_password1") or cleaned.get("password1")
        if pw and len(pw) < 12:
            if "new_password2" in self.fields:
                self.add_error("new_password2", forms.ValidationError("Password must have at least 12 characters."))
            elif "password2" in self.fields:
                self.add_error("password2", forms.ValidationError("Password must have at least 12 characters."))
            else:
                raise forms.ValidationError("Password must have at least 12 characters.")
        return cleaned

class UserChangeForm(forms.ModelForm):
    language = forms.ChoiceField(choices = [["", "Auto-detect"], ["English", "English"], ["Português", "Português"]], required = False)
    theme = forms.ChoiceField(choices = [[c, c] for c in ["System", "Light", "Dark"]], required = False)
    has_sidebar_open = forms.BooleanField(required = False)
    custom_instructions = forms.CharField(widget = forms.Textarea(attrs={
        "class": "chat-autoresize",
        "rows": "1",
        "wrap": "off",
        "style": "resize:none;overflow-x:auto;overflow-y:hidden;white-space:pre;box-sizing:border-box;width:100%;"
    }), required = False)
    nickname = forms.CharField(
        max_length=50,
        required=False,
        widget=forms.TextInput(attrs={
            "class": "vTextField",
            "style": "box-sizing:border-box;width:100%;",
        }),
    )
    occupation = forms.CharField(
        max_length=50,
        required=False,
        widget=forms.TextInput(attrs={
            "class": "vTextField",
            "style": "box-sizing:border-box;width:100%;",
        }),
    )
    about = forms.CharField(widget = forms.Textarea(attrs={
        "class": "chat-autoresize",
        "rows": "1",
        "wrap": "off",
        "style": "resize:none;overflow-x:auto;overflow-y:hidden;white-space:pre;box-sizing:border-box;width:100%;"
    }), required = False)

    is_enabled = forms.BooleanField(required = False)
    secret = forms.CharField(required = False, help_text = "Hex-encoded secret (binary). Leave blank to keep current.")
    backup_codes = forms.CharField(widget = forms.Textarea, required = False, help_text = "One code per line (will be stored as JSON list).")

    password = ReadOnlyPasswordHashField(
        label = "Password",
        help_text = mark_safe(
            "Raw passwords are not stored, so there is no way to see this user's password, "
            'but you can change the password using <a href="../password/">this form</a>.'
        )
    )

    class Meta:
        model = User
        fields = ("email", "password")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        user = kwargs.get("instance")
        if type(user) == User:
            preferences = user.preferences
            if type(preferences) == UserPreferences:
                self.fields["language"].initial = preferences.language
                self.fields["theme"].initial = preferences.theme
                self.fields["has_sidebar_open"].initial = preferences.has_sidebar_open
                self.fields["custom_instructions"].initial = preferences.custom_instructions
                self.fields["nickname"].initial = preferences.nickname
                self.fields["occupation"].initial = preferences.occupation
                self.fields["about"].initial = preferences.about

            mfa = user.mfa
            if type(mfa) == UserMFA:
                try:
                    self.fields["secret"].initial = binascii.hexlify(mfa.secret).decode() if mfa.secret else ""
                except Exception:
                    self.fields["secret"].initial = ""
                try:
                    self.fields["backup_codes"].initial = "\n".join(mfa.backup_codes or [])
                except Exception:
                    self.fields["backup_codes"].initial = ""
                self.fields["is_enabled"].initial = mfa.is_enabled

    def save(self, commit = True):
        user = super().save(commit = commit)

        preferences, _ = UserPreferences.objects.get_or_create(user = user)
        mfa, _ = UserMFA.objects.get_or_create(user = user)

        preferences.language = self.cleaned_data.get("language", preferences.language)
        preferences.theme = self.cleaned_data.get("theme", preferences.theme)
        preferences.has_sidebar_open = bool(self.cleaned_data.get("has_sidebar_open", preferences.has_sidebar_open))
        preferences.custom_instructions = self.cleaned_data.get("custom_instructions", preferences.custom_instructions)
        preferences.nickname = self.cleaned_data.get("nickname", preferences.nickname)
        preferences.occupation = self.cleaned_data.get("occupation", preferences.occupation)
        preferences.about = self.cleaned_data.get("about", preferences.about)
        preferences.save()

        mfa.is_enabled = bool(self.cleaned_data.get("is_enabled", mfa.is_enabled))
        secret_val = self.cleaned_data.get("secret", "")
        if secret_val:
            try:
                mfa.secret = binascii.unhexlify(secret_val)
            except Exception:
                pass
        backup_text = self.cleaned_data.get("backup_codes", "")
        if type(backup_text) == str:
            lines = [l.strip() for l in backup_text.splitlines() if l.strip()]
            mfa.backup_codes = lines
        mfa.save()

        return user

class UserAdmin(DjangoUserAdmin):
    model = User
    form = UserChangeForm
    change_password_form = AdminPasswordChangeFormWithMinLength

    class _AdminUserCreationFormWithMinLength(AdminUserCreationForm):
        def clean(self):
            cleaned = super().clean()
            pw = cleaned.get("password1") or cleaned.get("password2")
            if pw and len(pw) < 12:
                self.add_error("password2", forms.ValidationError("Password must have at least 12 characters."))
            return cleaned

    add_form = _AdminUserCreationFormWithMinLength
    fieldsets = (
        (None, {"fields": ("email", "password")} ),
        (("Preferences"), {"fields": ("language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about")} ),
        (("MFA"), {"fields": ("mfa_display",)} ),
        (("Sessions"), {"fields": ("sessions_display",)} ),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")} ),
        (("Important dates"), {"fields": ("last_login", "created_at_display")} )
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )

    list_display = ("email", "is_staff", "is_superuser", "is_active", "created_at_display")
    readonly_fields = ("email", "last_login", "created_at", "created_at_display", "mfa_display" ,"sessions_display")

    class Media:
        css = {"all": ("chat/css/admin_mfa.css", "chat/css/admin_sessions.css")}
        js = ("chat/js/admin_mfa.js", "chat/js/autoresize.js")

    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    search_fields = ("email",)
    ordering = ("email",)
    filter_horizontal = ("groups", "user_permissions")

    def get_form(self, request, obj=None, **kwargs):
        defaults = {}
        if obj is None:
            defaults["form"] = self.add_form
        defaults.update(kwargs)
        return super().get_form(request, obj, **defaults)

    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.readonly_fields)
        if obj is None and "email" in readonly:
            readonly.remove("email")
        return tuple(readonly)

    def save_model(self, request, obj, form, change):
        user = form.save(True)
        try:
            UserPreferences.objects.get_or_create(user = user)
            UserMFA.objects.get_or_create(user = user)
        except Exception:
            logger.exception("Error creating related UserPreferences/UserMFA")

    def sessions_display(self, user: User):
        total = user.sessions.count()
        active = user.sessions.filter(logout_at = None).count()
        inactive = user.sessions.exclude(logout_at = None).count()
        sessions = user.sessions.filter(user = user).order_by("-login_at")[:10]
        items = []
        for s in sessions:
            logout_at = s.logout_at.strftime("%Y-%m-%d %H:%M:%S") if s.logout_at else "Active"

            if s.device:
                family = s.device.partition("family=")[2].partition(",")[0].replace("'", "")
                brand = s.device.partition("brand=")[2].partition(",")[0]
                model = s.device.partition("model=")[2].partition(",")[0].replace(")", "")
                device_info = f"Family: {family} Brand: {brand} Model: {model}"
            else:
                device_info = "N/A"

            items.append({
                "login_at": s.login_at.strftime("%Y-%m-%d %H:%M:%S"),
                "logout_at": logout_at,
                "ip_address": s.ip_address,
                "user_agent": s.user_agent,
                "device": device_info,
                "browser": s.browser,
                "os": s.os,
            })
        rendered = render_to_string(
            "chat/sessions_display.html",
            {"total": total, "active": active, "inactive": inactive, "sessions": [i for i in enumerate(items, 1)]}
        )
        return mark_safe(rendered)

    def created_at_display(self, user: User):
        field = User._meta.get_field("created_at")
        return display_for_field(user.created_at, field, "-")

    created_at_display.short_description = "Created"

    def mfa_display(self, user: User):
        try:
            mfa = user.mfa
        except Exception:
            mfa = None

        if not mfa:
            return ""

        is_enabled = "Yes" if mfa.is_enabled else "No"
        try:
            secret_hex = binascii.hexlify(mfa.secret).decode() if mfa.secret else ""
        except Exception:
            secret_hex = ""
        backup_text = "\n".join(mfa.backup_codes or []) if mfa.backup_codes else ""

        disable_url = reverse("admin:chat_user_disable_mfa", args=[user.pk]) if mfa.is_enabled else ""
        context = {
            "is_enabled": is_enabled,
            "secret_hex": secret_hex,
            "backup_text": backup_text,
            "show_disable": bool(mfa.is_enabled),
            "disable_url": disable_url,
        }
        rendered = render_to_string("chat/mfa_display.html", context)
        return mark_safe(rendered)

    mfa_display.short_description = "MFA"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("<path:object_id>/disable-mfa/", self.admin_site.admin_view(self.user_disable_mfa_view), name="chat_user_disable_mfa"),
        ]
        return custom_urls + urls

    def user_disable_mfa_view(self, request, object_id, *args, **kwargs):
        user = get_object_or_404(User, pk = object_id)
        if request.method != "POST":
            messages.error(request, "Invalid request method.")
            return redirect(reverse("admin:chat_user_change", args = [user.pk]))

        try:
            mfa = user.mfa
        except Exception:
            mfa = None

        if not mfa:
            messages.error(request, "User has no MFA configured.")
            return redirect(reverse("admin:chat_user_change", args = [user.pk]))

        try:
            mfa.disable()
            messages.success(request, "MFA disabled for user.")
        except Exception:
            logger.exception("Error disabling user MFA")
            messages.error(request, "Failed to disable MFA for user.")

        return redirect(reverse("admin:chat_user_change", args = [user.pk]))

class UserSessionAdmin(admin.ModelAdmin):
    model = UserSession
    readonly_fields = (
        "user_display", "login_at_display", "logout_at_display", "ip_address_display",
        "user_agent_display", "device_display", "browser", "os_display", "refresh_jti_display"
    )
    fields = (
        "user_display", "login_at_display", "logout_at_display", "ip_address_display",
        "user_agent_display", "device_display", "browser", "os_display", "refresh_jti_display"
    )
    list_display = (
        "user__email", "login_at_display", "logout_at_display", "ip_address_display", "device_display", "browser", "os_display"
    )
    search_fields = ("user__email", "ip_address", "user_agent", "device", "browser", "os")
    ordering = ("-login_at",)

    def user_display(self, session: UserSession):
        if not session.user:
            return ""
        url = f"/admin/chat/user/{session.user.pk}/change/"
        return mark_safe(f"<a href=\"{url}\">{session.user.email}</a>")

    user_display.short_description = "User"

    def login_at_display(self, session: UserSession):
        field = UserSession._meta.get_field("login_at")
        return display_for_field(session.login_at, field, "-")

    login_at_display.short_description = "Login"

    def logout_at_display(self, session: UserSession):
        field = UserSession._meta.get_field("logout_at")
        return display_for_field(session.logout_at, field, "Active")

    logout_at_display.short_description = "Logout"

    def ip_address_display(self, session: UserSession):
        return session.ip_address or "N/A"

    ip_address_display.short_description = "IP Address"

    def user_agent_display(self, session: UserSession):
        return session.user_agent or "N/A"

    user_agent_display.short_description = "User Agent"

    def device_display(self, session: UserSession):
        if not session.device:
            return "N/A"

        family = session.device.partition("family=")[2].partition(",")[0].replace("'", "").replace("None", "N/A")
        brand = session.device.partition("brand=")[2].partition(",")[0].replace("None", "N/A")
        model = session.device.partition("model=")[2].partition(",")[0].replace(")", "").replace("None", "N/A")

        return mark_safe(
            "<pre style=\"white-space:pre-wrap;word-break:break-all;\">"
            f"Family: {family}\nBrand: {brand}\nModel: {model}"
            "</pre>"
        )

    device_display.short_description = "Device"

    def os_display(self, session: UserSession):
        return session.os or "N/A"

    os_display.short_description = "Operating System"

    def refresh_jti_display(self, session: UserSession):
        if not session.refresh_jti:
            return "None"

        blacklisted_token = BlacklistedToken.objects.filter(token__jti = session.refresh_jti).first()
        outstanding_token = OutstandingToken.objects.filter(jti = session.refresh_jti).first()

        parts = []
        if blacklisted_token:
            blacklisted_url = f"/admin/token_blacklist/blacklistedtoken/{blacklisted_token.pk}/change/"
            parts.append(mark_safe(f'Blacklisted: <a href="{blacklisted_url}">{session.refresh_jti}</a>'))
        else:
            parts.append(f"Not blacklisted: {session.refresh_jti}")
        if outstanding_token:
            outstanding_url = f"/admin/token_blacklist/outstandingtoken/{outstanding_token.pk}/change/"
            parts.append(mark_safe(f'Outstanding: <a href="{outstanding_url}">{session.refresh_jti}</a>'))
        else:
            parts.append(f"Not outstanding: {session.refresh_jti}")

        return mark_safe("<br>".join(parts))

    refresh_jti_display.short_description = "Refresh JTI"

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

class ChatAdmin(admin.ModelAdmin):
    model = Chat
    inlines = (MessageInline,)

    class Media:
        js = ("chat/js/admin_pending.js",)
    readonly_fields = ("user_link", "display_uuid", "pending_message_display", "created_at_display")
    fieldsets = (
        (None, {"fields": ("user_link", "display_uuid", "title", "pending_message_display", "is_archived", "created_at_display")} ),
    )
    list_display = ("title", "uuid", "user_link", "is_pending", "is_archived_display", "created_at_display")
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

        msg = chat.pending_message
        msg_url = f"/admin/chat/message/{msg.pk}/change/"
        stop_url = reverse("admin:chat_chat_stop_pending", args=[chat.pk])
        button = f'<button type="button" class="button" onclick="chat_admin_stop_pending(\'{stop_url}\', this)">Stop</button>'

        return mark_safe(f'<a href="{msg_url}">Message #{msg.pk}</a> &nbsp; {button}')

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

    def created_at_display(self, chat: Chat):
        field = Chat._meta.get_field("created_at")
        return display_for_field(chat.created_at, field, "-")

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

admin.site.unregister(Group)

admin.site.register(User, UserAdmin)
admin.site.register(UserSession, UserSessionAdmin)
admin.site.register(Chat, ChatAdmin)
admin.site.register(Message, MessageAdmin)