import pyotp

def verify_mfa(secret: str, code: str) -> bool:
    if not secret:
        return False
    else:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window = 1)

def generate_mfa_secret() -> str:
    return pyotp.random_base32()

def build_mfa_auth_url(secret: str, email: str, issuer: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name = email, issuer_name = issuer)