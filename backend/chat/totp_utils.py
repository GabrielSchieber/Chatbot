import pyotp

def verify_totp(secret: str, code: str) -> bool:
    if not secret:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window = 1)

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def build_otpauth_url(secret: str, email: str, issuer: str = "MyChatApp") -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name = email, issuer_name = issuer)