import binascii

from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.utils.safestring import mark_safe
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import Chat, Message, MessageFile, User, UserMFA, UserPreferences

class UserChangeForm(forms.ModelForm):
	# Preference fields (prefix with pref_)
	pref_language = forms.ChoiceField(choices=[(c, c) for c in ["", "English", "Português"]], required=False)
	pref_theme = forms.ChoiceField(choices=[(c, c) for c in ["System", "Light", "Dark"]], required=False)
	pref_has_sidebar_open = forms.BooleanField(required=False)
	pref_custom_instructions = forms.CharField(widget=forms.Textarea, required=False)
	pref_nickname = forms.CharField(max_length=50, required=False)
	pref_occupation = forms.CharField(max_length=50, required=False)
	pref_about = forms.CharField(widget=forms.Textarea, required=False)

	# MFA fields (prefix with mfa_)
	mfa_is_enabled = forms.BooleanField(required=False)
	mfa_secret = forms.CharField(required=False, help_text="Hex-encoded secret (binary). Leave blank to keep current.)")
	mfa_backup_codes = forms.CharField(widget=forms.Textarea, required=False, help_text="One code per line (will be stored as JSON list).")

	# show password as the read-only hash field with the standard change-password link
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
				self.fields["pref_language"].initial = prefs.language
				self.fields["pref_theme"].initial = prefs.theme
				self.fields["pref_has_sidebar_open"].initial = prefs.has_sidebar_open
				self.fields["pref_custom_instructions"].initial = prefs.custom_instructions
				self.fields["pref_nickname"].initial = prefs.nickname
				self.fields["pref_occupation"].initial = prefs.occupation
				self.fields["pref_about"].initial = prefs.about

			# Populate MFA
			try:
				mfa = user.mfa
			except Exception:
				mfa = None
			if mfa:
				# show secret as hex
				try:
					self.fields["mfa_secret"].initial = binascii.hexlify(mfa.secret).decode() if mfa.secret else ""
				except Exception:
					self.fields["mfa_secret"].initial = ""
				# backup codes as newline-separated
				try:
					self.fields["mfa_backup_codes"].initial = "\n".join(mfa.backup_codes or [])
				except Exception:
					self.fields["mfa_backup_codes"].initial = ""
				self.fields["mfa_is_enabled"].initial = mfa.is_enabled

	def save(self, commit=True):
		user = super().save(commit=commit)

		# Ensure related instances exist
		prefs, _ = UserPreferences.objects.get_or_create(user=user)
		mfa, _ = UserMFA.objects.get_or_create(user=user)

		# Save preferences
		prefs.language = self.cleaned_data.get("pref_language", prefs.language)
		prefs.theme = self.cleaned_data.get("pref_theme", prefs.theme)
		prefs.has_sidebar_open = bool(self.cleaned_data.get("pref_has_sidebar_open", prefs.has_sidebar_open))
		prefs.custom_instructions = self.cleaned_data.get("pref_custom_instructions", prefs.custom_instructions)
		prefs.nickname = self.cleaned_data.get("pref_nickname", prefs.nickname)
		prefs.occupation = self.cleaned_data.get("pref_occupation", prefs.occupation)
		prefs.about = self.cleaned_data.get("pref_about", prefs.about)
		prefs.save()

		# Save MFA
		mfa.is_enabled = bool(self.cleaned_data.get("mfa_is_enabled", mfa.is_enabled))
		secret_val = self.cleaned_data.get("mfa_secret", "")
		if secret_val:
			try:
				mfa.secret = binascii.unhexlify(secret_val)
			except Exception:
				# if not valid hex, leave unchanged
				pass
		# parse backup codes: one per line
		backup_text = self.cleaned_data.get("mfa_backup_codes", "")
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
		(None, {"fields": (
			"email", "password",
			# preferences
			"pref_language", "pref_theme", "pref_has_sidebar_open", "pref_custom_instructions", "pref_nickname", "pref_occupation", "pref_about",
			# mfa
			"mfa_is_enabled", "mfa_secret", "mfa_backup_codes",
		)}),
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

admin.site.register(Chat)
admin.site.register(Message)
admin.site.register(MessageFile)
admin.site.register(UserMFA)
admin.site.register(UserPreferences)