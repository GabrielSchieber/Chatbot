from ..models import User

def create_user(email: str = "test@example.com", password: str = "testpassword") -> User:
    return User.objects.create_user(email = email, password = password)