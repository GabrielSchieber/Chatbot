import binascii

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.contrib.auth.models import Group
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _
from django.urls import path, reverse
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages

from . import tasks
import logging

logger = logging.getLogger(__name__)

from .models import Chat, Message, MessageFile, User, UserMFA, UserPreferences

class UserChangeForm(forms.ModelForm):
	# Preference fields (use original names from UserPreferences)
	language = forms.ChoiceField(choices=[(c, c) for c in ["", "English", "Português"]], required=False)
	theme = forms.ChoiceField(choices=[(c, c) for c in ["System", "Light", "Dark"]], required=False)
	has_sidebar_open = forms.BooleanField(required=False)
	custom_instructions = forms.CharField(widget=forms.Textarea, required=False)
	nickname = forms.CharField(max_length=50, required=False)
	occupation = forms.CharField(max_length=50, required=False)
	about = forms.CharField(widget=forms.Textarea, required=False)

	# MFA fields (use original names from UserMFA)
	is_enabled = forms.BooleanField(required=False)
	secret = forms.CharField(required=False, help_text="Hex-encoded secret (binary). Leave blank to keep current.")
	backup_codes = forms.CharField(widget=forms.Textarea, required=False, help_text="One code per line (will be stored as JSON list).")

	# show password as the read-only hash field with the sstandard change-password link
	password = ReadOnlyPasswordHashField(label="Password",
										help_text=mark_safe(
											'Raw passwords are not stored, so there is no way to see this user\'s password, '
											'but you can change the password using <a href="../password/">this form</a>.'
										))

	class Meta:
		model = User
		fields = ("email", "password")

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		user = kwargs.get("instance")
		if user is not None:
			# Populate preferences
			try:
				prefs = user.preferences
			except Exception:
				prefs = None
			if prefs:
				self.fields["language"].initial = prefs.language
				self.fields["theme"].initial = prefs.theme
				self.fields["has_sidebar_open"].initial = prefs.has_sidebar_open
				self.fields["custom_instructions"].initial = prefs.custom_instructions
				self.fields["nickname"].initial = prefs.nickname
				self.fields["occupation"].initial = prefs.occupation
				self.fields["about"].initial = prefs.about

			# Populate MFA
			try:
				mfa = user.mfa
			except Exception:
				mfa = None
			if mfa:
				# show secret as hex
				try:
					self.fields["secret"].initial = binascii.hexlify(mfa.secret).decode() if mfa.secret else ""
				except Exception:
					self.fields["secret"].initial = ""
				# backup codes as newline-separated
				try:
					self.fields["backup_codes"].initial = "\n".join(mfa.backup_codes or [])
				except Exception:
					self.fields["backup_codes"].initial = ""
				self.fields["is_enabled"].initial = mfa.is_enabled

	def save(self, commit=True):
		user = super().save(commit=commit)

		# Ensure related instances exist
		prefs, _ = UserPreferences.objects.get_or_create(user=user)
		mfa, _ = UserMFA.objects.get_or_create(user=user)

		# Save preferences
		prefs.language = self.cleaned_data.get("language", prefs.language)
		prefs.theme = self.cleaned_data.get("theme", prefs.theme)
		prefs.has_sidebar_open = bool(self.cleaned_data.get("has_sidebar_open", prefs.has_sidebar_open))
		prefs.custom_instructions = self.cleaned_data.get("custom_instructions", prefs.custom_instructions)
		prefs.nickname = self.cleaned_data.get("nickname", prefs.nickname)
		prefs.occupation = self.cleaned_data.get("occupation", prefs.occupation)
		prefs.about = self.cleaned_data.get("about", prefs.about)
		prefs.save()

		# Save MFA
		mfa.is_enabled = bool(self.cleaned_data.get("is_enabled", mfa.is_enabled))
		secret_val = self.cleaned_data.get("secret", "")
		if secret_val:
			try:
				mfa.secret = binascii.unhexlify(secret_val)
			except Exception:
				# if not valid hex, leave unchanged
				pass
		# parse backup codes: one per line
		backup_text = self.cleaned_data.get("backup_codes", "")
		if backup_text is not None:
			lines = [l.strip() for l in backup_text.splitlines() if l.strip()]
			mfa.backup_codes = lines
		mfa.save()

		return user

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
	model = User
	form = UserChangeForm
	fieldsets = (
		(None, {"fields": ("email", "password")} ),
		(_("Preferences"), {"fields": ("language", "theme", "has_sidebar_open", "custom_instructions", "nickname", "occupation", "about")} ),
		(_("MFA"), {"fields": ("is_enabled", "secret", "backup_codes")} ),
		(_("Permissions"), {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")} ),
		(_("Important dates"), {"fields": ("last_login",)} ),
	)

	add_fieldsets = (
		(None, {
			"classes": ("wide",),
			"fields": ("email", "password1", "password2"),
		}),
	)

	list_display = ("email", "is_staff", "is_superuser", "is_active", "created_at")
	readonly_fields = ("email", "last_login", "created_at")
	list_filter = ("is_staff", "is_superuser", "is_active", "groups")
	search_fields = ("email",)
	ordering = ("email",)
	filter_horizontal = ("groups", "user_permissions")

class MessageForm(forms.ModelForm):
	class Meta:
		model = Message
		fields = "__all__"
		widgets = {
			"text": forms.Textarea(attrs={
				"class": "chat-autoresize",
				"rows": "1",
				"wrap": "off",
				"style": "resize:none;overflow-x:auto;overflow-y:hidden;white-space:pre;box-sizing:border-box;width:100%;",
			}),
		}

class MessageInline(admin.StackedInline):
	model = Message
	form = MessageForm
	fields = ("text", "files_display", "is_from_user", "model", "last_modified_at", "created_at")
	readonly_fields = ("files_display", "last_modified_at", "created_at")
	extra = 0
	show_change_link = True

	class Media:
		js = ("chat/js/autoresize.js",)

	def files_display(self, obj):
		if not obj.pk:
			return ""
		files = obj.files.all()
		if not files:
			return ""
		items = []
		for f in files:
			meta = f"<strong>{f.name}</strong> — {f.content_type} — {f.created_at.strftime('%Y-%m-%d %H:%M:%S')}"
			# Try to decode content as UTF-8 and show a short preview if printable
			preview = "(binary content hidden)"
			try:
				data = f.content
				if isinstance(data, (bytes, bytearray)):
					try:
						text = data.decode("utf-8")
						# show only if text is printable (allow common whitespace)
						if all(ch.isprintable() or ch in "\n\r\t" for ch in text):
							preview = "<pre>" + (text[:1000] + ("..." if len(text) > 1000 else "")) + "</pre>"
					except UnicodeDecodeError:
						preview = "(binary content hidden)"
				else:
					preview = "(binary content hidden)"
			except Exception:
				preview = "(unable to read content)"
			items.append(f"<li>{meta}<br/>{preview}</li>")
		return mark_safe("<ul style=\"list-style:none;padding:0;margin:0;\">" + "".join(items) + "</ul>")

	files_display.short_description = "Files"

class ChatAdmin(admin.ModelAdmin):
	model = Chat
	inlines = (MessageInline,)
	# show user's email first as a link to the related User admin page
	# show user's email first as a link to the related User admin page
	readonly_fields = ("user_link", "uuid", "created_at", "pending_message_display")
	fieldsets = (
		(None, {"fields": ("user_link", "uuid", "title", "pending_message_display", "is_archived")} ),
	)
	list_display = ("title", "user", "is_archived", "created_at")
	search_fields = ("title", "user__email")
	ordering = ("-created_at",)

	def user_link(self, obj):
		if not obj.user:
			return ""
		url = f"/admin/chat/user/{obj.user.pk}/change/"
		return mark_safe(f"<a href=\"{url}\">{obj.user.email}</a>")
	user_link.short_description = "User"
	user_link.admin_order_field = "user__email"

	def pending_message_display(self, obj):
		# Show a link to the pending Message and a Stop button when present
		if not obj.pending_message:
			return ""

		msg = obj.pending_message
		msg_url = f"/admin/chat/message/{msg.pk}/change/"
		stop_url = reverse('admin:chat_chat_stop_pending', args=[obj.pk])
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
			path('<path:object_id>/stop-pending/', self.admin_site.admin_view(self.stop_pending_view), name='chat_chat_stop_pending'),
		]
		return custom_urls + urls

	def stop_pending_view(self, request, object_id, *args, **kwargs):
		chat = get_object_or_404(Chat, pk=object_id)
		# Only allow POST to perform the stop (admin_view enforces auth)
		if request.method != 'POST':
			messages.error(request, 'Invalid request method.')
			return redirect(reverse('admin:chat_chat_change', args=[chat.pk]))

		# Call the task helper to cancel background generation and clear pending_message
		try:
			tasks.stop_pending_chat(chat)
			messages.success(request, 'Pending message generation stopped.')
		except Exception:
			logger.exception('Error stopping pending chat')
			messages.error(request, 'Failed to stop pending message generation.')

		return redirect(reverse('admin:chat_chat_change', args=[chat.pk]))

admin.site.unregister(Group)

admin.site.register(Chat, ChatAdmin)