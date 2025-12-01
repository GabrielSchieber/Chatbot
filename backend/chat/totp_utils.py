import secrets

import pyotp
from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.hashers import make_password

def get_cipher():
    return Fernet(settings.TOTP_ENCRYPTION_KEY.encode())

def encrypt_secret(secret: str):
    return get_cipher().encrypt(secret.encode())

def decrypt_secret(encrypted_secret: bytes) -> str:
    return get_cipher().decrypt(encrypted_secret).decode()

def verify_secret(encrypted_secret: str, code: str):
    return pyotp.TOTP(decrypt_secret(encrypted_secret)).verify(code, valid_window = 1)

def generate_secret():
    secret = pyotp.random_base32()
    encrypted_secret = encrypt_secret(secret)
    return secret, encrypted_secret

def generate_auth_url(secret: str, email: str):
    return  pyotp.totp.TOTP(secret).provisioning_uri(email, "Chatbot")

def generate_backup_codes():
    backup_codes = [secrets.token_hex(6).upper() for _ in range(10)]
    hashed_backup_codes = [make_password(code) for code in backup_codes]
    return backup_codes, hashed_backup_codes