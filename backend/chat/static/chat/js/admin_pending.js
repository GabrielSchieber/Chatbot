function _chatAdmin_getCsrf() {
    var m = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
    return m ? m[2] : null;
}

function chat_admin_stop_pending(url, btn) {
    if (!confirm('Stop pending message generation?')) return;
    if (btn) btn.disabled = true;
    var csrftoken = _chatAdmin_getCsrf();
    fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrftoken }, credentials: 'same-origin' })
        .then(function (r) {
            if (r.ok) location.reload();
            else {
                alert('Failed to stop');
                if (btn) btn.disabled = false;
            }
        })
        .catch(function (e) {
            alert('Error stopping pending message');
            if (btn) btn.disabled = false;
        });
}
