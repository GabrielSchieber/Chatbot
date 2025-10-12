import secrets

import pyotp
from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password

from .models import User

def get_cipher():
    return Fernet(settings.TOTP_ENCRYPTION_KEY.encode())

def verify_mfa(user: User, code: str) -> bool:
    if pyotp.TOTP(decrypt_totp_secret(user.secret)).verify(code, valid_window = 1):
        return True
    else:
        for stored_hash in user.backup_codes:
            if check_password(code, stored_hash):
                user.backup_codes.remove(stored_hash)
                user.save()
                return True
    return False

def generate_mfa_secret() -> str:
    return pyotp.random_base32()

def build_mfa_auth_url(secret: str, email: str, issuer: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name = email, issuer_name = issuer)

def encrypt_totp_secret(secret: str):
    return get_cipher().encrypt(secret.encode())

def decrypt_totp_secret(encrypted_secret: bytes) -> str:
    return get_cipher().decrypt(encrypted_secret).decode()

def generate_backup_codes(count: int):
    codes = [secrets.token_hex(6).upper() for _ in range(count)]
    hashed_codes = [make_password(code) for code in codes]
    return codes, hashed_codes