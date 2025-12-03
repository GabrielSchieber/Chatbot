from django.test import TestCase

class JWTAuthCookieMiddleware(TestCase):
    def test_auth_header_is_added_when_access_token_cookie_exists(self):
        self.client.cookies["access_token"] = "abc123"

        response = self.client.get("/test/echo-auth/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["auth"], "Bearer abc123")

    def test_auth_header_is_not_added_if_cookie_missing(self):
        response = self.client.get("/test/echo-auth/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["auth"])