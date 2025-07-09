import re

import markdown
from django.utils.html import escape

MARKDOWN_PATTERN = re.compile(f"({re.escape(r"```")}|{re.escape(r"`")})")

def markdown_message(message: str) -> str:
    message = escape_markdown(message)
    message = markdown.markdown(message, extensions = ["extra", "fenced_code", "codehilite"])
    return message

def escape_markdown(message: str) -> str:
    message = MARKDOWN_PATTERN.split(message)
    message = list(filter(None, message))

    escaped_message = []

    i = 0
    while i < len(message):
        message_i = message[i]

        if (i < len(message) - 2 and (message_i == r"```" or message_i == r"`") and message[i + 2] == message_i):
            escaped_message.extend(message[i : i + 3])
            i += 3
            continue

        if i < len(message):
            escaped_message.append(escape(message_i))
            i += 1

    escaped_message = "".join(escaped_message)
    return escaped_message