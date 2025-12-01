function _chatAdmin_getCsrf() {
    const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/)
    return match ? match[2] : null
}

function chat_admin_revoke_sessions(url, button) {
    if (!confirm("Revoke all session tokens for this user?")) {
        return
    }

    if (button) {
        button.disabled = true
    }

    const csrfToken = _chatAdmin_getCsrf()
    fetch(url, { method: "POST", headers: { "X-CSRFToken": csrfToken }, credentials: "same-origin" })
        .then(response => {
            if (response.ok) {
                location.reload()
            } else {
                alert("Failed to revoke tokens.")
                if (button) {
                    button.disabled = false
                }
            }
        })
        .catch(_ => {
            alert("Error revoking tokens.")
            if (button) {
                button.disabled = false
            }
        })
}