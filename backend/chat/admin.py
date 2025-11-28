import binascii
import logging

logger = logging.getLogger(__name__)

from django import forms
from django.contrib import admin, messages
from django.contrib.admin.utils import display_for_field
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.contrib.auth.models import Group
from django.shortcuts import get_object_or_404, redirect
from django.urls import path, reverse
from django.utils.safestring import mark_safe

from .models import Chat, Message, User, UserMFA, UserPreferences
from .tasks import stop_pending_chat

class UserChangeForm(forms.ModelForm):
	language = forms.ChoiceField(choices = [[c, c] for c in ["", "English", "Português"]], required = False)
	theme = forms.ChoiceField(choices = [[c, c] for c in ["System", "Light", "Dark"]], required = False)
	has_sidebar_open = forms.BooleanField(required = False)
	custom_instructions = forms.CharField(widget = forms.Textarea, required = False)
	nickname = forms.CharField(max_length = 50, required = False)
	occupation = forms.CharField(max_length = 50, required = False)
	about = forms.CharField(widget = forms.Textarea, required = False)

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
				except:
					self.fields["secret"].initial = ""
				try:
					self.fields["backup_codes"].initial = "\n".join(mfa.backup_codes or [])
				except:
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
			except:
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
	fieldsets = (
		(None, {"fields": ("email", "password")} ),
		("Preferences", {"fields": ("language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about")} ),
		("MFA", {"fields": ("is_enabled", "secret", "backup_codes")} ),
		("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")} ),
		("Important dates", {"fields": ("last_login", "created_at_display")} )
	)

	add_fieldsets = (
		(None, {
			"classes": ("wide",),
			"fields": ("email", "password1", "password2")
		})
	)

	list_display = ("email", "is_staff", "is_superuser", "is_active", "created_at_display")
	readonly_fields = ("email", "last_login", "created_at", "created_at_display")
	list_filter = ("is_staff", "is_superuser", "is_active", "groups")
	search_fields = ("email",)
	ordering = ("email",)
	filter_horizontal = ("groups", "user_permissions")

	def created_at_display(self, user: User):
		field = User._meta.get_field("created_at")
		return display_for_field(user.created_at, field, "-")

	created_at_display.short_description = "Created"

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
			meta = f"<strong>{f.name}</strong> — {f.content_type} — {f.created_at.strftime("%Y-%m-%d %H:%M:%S")}"
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
				else:
					preview = "(binary content hidden)"
			except:
				preview = "(unable to read content)"
			items.append(f"<li>{meta}<br/>{preview}</li>")
		return mark_safe("<ul style=\"list-style:none;padding:0;margin:0;\">" + "".join(items) + "</ul>")

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
		button = (
			f'<button type="button" class="button" '
			f'onclick="(function(btn){{if(!confirm(\'Stop pending message generation?\'))return;'
			f'btn.disabled=true;var csr=document.cookie.match(/(^|;)\\s*csrftoken=([^;]+)/);var csrftoken=csr?csr[2]:null;'
			f'fetch(\'{stop_url}\',{{method:\'POST\',headers:{{\'X-CSRFToken\':csrftoken}},credentials:\'same-origin\'}})'
			f'.then(function(r){{if(r.ok)location.reload();else{{alert(\'Failed to stop\');btn.disabled=false;}}}})'
			f'.catch(function(e){{alert(\'Error stopping pending message\');btn.disabled=false;}});}})(this)">Stop</button>'
		)

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
		except:
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
			meta = f"<strong>{f.name}</strong> — {f.content_type} — {f.created_at.strftime("%Y-%m-%d %H:%M:%S")}"
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
				else:
					preview = "(binary content hidden)"
			except:
				preview = "(unable to read content)"
			items.append(f"<li>{meta}<br/>{preview}</li>")
		return mark_safe("<ul style=\"list-style:none;padding:0;margin:0;\">" + "".join(items) + "</ul>")

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
admin.site.register(Chat, ChatAdmin)
admin.site.register(Message, MessageAdmin)