function _chatAdmin_getCsrf() {
    const match = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/)
    return match ? match[2] : null
}

function chat_admin_stop_pending(url, button) {
    if (!confirm("Stop pending message generation?")) {
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
                alert("Failed to stop.")
                if (button) {
                    button.disabled = false
                }
            }
        })
        .catch(_ => {
            alert("Error stopping pending message.")
            if (button) {
                button.disabled = false
            }
        })
}