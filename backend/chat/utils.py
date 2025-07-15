import re

import markdown
from django.utils.html import escape

MARKDOWN_PATTERN = re.compile(f"({re.escape(r"```")}|{re.escape(r"`")})")

def markdown_to_html(message: str) -> str:
    message, languages = escape_markdown(message)
    message = markdown.markdown(message, extensions = ["extra", "fenced_code", "codehilite"])
    message = add_language_name_to_code_hilites(message, languages)
    return message

def escape_markdown(message: str) -> tuple[str, list[str]]:
    message = MARKDOWN_PATTERN.split(message)
    message = list(filter(None, message))

    escaped_message = []
    languages = []

    i = 0
    while i < len(message):
        message_i = message[i]

        if (i < len(message) - 2 and (message_i == r"```" or message_i == r"`") and message[i + 2] == message_i):
            if message_i == "```":
                languages.append(message[i + 1].split("\n")[0])
            escaped_message.extend(message[i:i + 3])
            i += 3
            continue

        if i < len(message):
            escaped_message.append(escape(message_i))
            i += 1

    escaped_message = "".join(escaped_message)
    return escaped_message, languages

def add_language_name_to_code_hilites(message: str, languages: list[str]) -> str:
    old = "<div class=\"codehilite\">"
    for language in languages:
        new = f"<div class=\"codehilite\" data-language=\"{language}\">"
        message = message.replace(old, new, 1)
    return message