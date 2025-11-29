function _chatAdmin_getCsrf() {
    var m = document.cookie.match(/(^|;)\s*csrftoken=([^;]+)/);
    return m ? m[2] : null;
}

function chat_admin_disable_mfa(url, btn) {
    if (!confirm('Disable MFA for this user?')) return;
    if (btn) btn.disabled = true;
    var csrftoken = _chatAdmin_getCsrf();
    fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrftoken }, credentials: 'same-origin' })
        .then(function (r) {
            if (r.ok) location.reload();
            else {
                alert('Failed to disable MFA');
                if (btn) btn.disabled = false;
            }
        })
        .catch(function (e) {
            alert('Error disabling MFA');
            if (btn) btn.disabled = false;
        });
}
