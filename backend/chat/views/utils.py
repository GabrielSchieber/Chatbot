from user_agents import parse

def readable_user_agent(user_agent_raw: str | None) -> str:
    if not user_agent_raw:
        return "Unknown device"

    ua = parse(user_agent_raw)

    parts = []

    if ua.browser.family:
        parts.append(ua.browser.family)

    if ua.os.family:
        parts.append(f"on {ua.os.family}")

    if ua.device.family and ua.device.family != "Other":
        parts.append(f"({ua.device.family})")

    return " ".join(parts) or "Unknown device"