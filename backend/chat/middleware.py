from django.core.handlers.asgi import ASGIRequest
from django.utils.deprecation import MiddlewareMixin
from user_agents import parse

class JWTAuthCookieMiddleware(MiddlewareMixin):
    def process_request(self, request: ASGIRequest):
        token = request.COOKIES.get("access_token")
        if token:
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"

class RequestInfoMiddleware(MiddlewareMixin):
    def process_request(self, request: ASGIRequest):
        request.ip_address = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0] or request.META.get("REMOTE_ADDR")

        ua_string = request.META.get("HTTP_USER_AGENT", "")
        request.user_agent_raw = ua_string

        ua = parse(ua_string)
        request.device = str(ua.device)
        request.browser = ua.browser.family
        request.os = ua.os.family