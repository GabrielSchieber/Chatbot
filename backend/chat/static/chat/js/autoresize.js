(function () {
    function autoResize(el) {
        if (!el) return;
        el.style.height = 'auto';
        // Add a small fudge to avoid cutting off last line in some browsers
        var newHeight = el.scrollHeight;
        // If a horizontal scrollbar will appear, add scrollbar height so it doesn't overlap content
        try {
            var sb = getScrollbarSize();
            if (el.scrollWidth > el.clientWidth) {
                newHeight += sb.height || 0;
            }
        } catch (e) { }
        el.style.height = (newHeight + 2) + 'px';
    }

    function setupTextarea(t) {
        if (!t) return;
        t.style.resize = 'none';
        t.style.overflow = 'hidden';
        t.style.boxSizing = 'border-box';
        // Ensure initial size
        autoResize(t);
        // Resize as user types
        t.addEventListener('input', function () { autoResize(t); }, false);
        // allow horizontal scroll, prevent vertical scrollbar (we auto-size height)
        t.style.overflowX = 'auto';
        t.style.overflowY = 'hidden';
        // ensure no wrapping
        t.wrap = 'off';
        t.style.whiteSpace = 'pre';
    }

    function setupAll() {
        document.querySelectorAll('textarea.chat-autoresize').forEach(function (t) {
            setupTextarea(t);
        });
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupAll);
    } else {
        setupAll();
    }

    // Handle Django admin's dynamically added inlines: listen for the custom event
    document.addEventListener('formset:added', function (event) {
        // new form is available on event.detail.form? Some admin scripts add it differently
        // We'll scan the newly-added node if present, else just re-run setupAll
        try {
            var form = event && event.detail && event.detail.form;
            if (form) {
                form.querySelectorAll && form.querySelectorAll('textarea.chat-autoresize').forEach(function (t) { setupTextarea(t); });
                return;
            }
        } catch (e) { }
        // fallback
        setTimeout(setupAll, 0);
    });

    // MutationObserver fallback: catch new textareas added to the DOM
    try {
        var obs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes && m.addedNodes.forEach(function (node) {
                    if (node && node.querySelectorAll) {
                        node.querySelectorAll('textarea.chat-autoresize').forEach(function (t) { setupTextarea(t); });
                        // if the node itself is a textarea
                        if (node.tagName === 'TEXTAREA' && node.classList && node.classList.contains('chat-autoresize')) {
                            setupTextarea(node);
                        }
                    }
                });
            });
        });
        obs.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
        // ignore
    }

    // Helper to measure native scrollbar size (cached)
    function getScrollbarSize() {
        if (window.__chat_scrollbar_size) return window.__chat_scrollbar_size;
        var outer = document.createElement('div');
        outer.style.visibility = 'hidden';
        outer.style.width = '100px';
        outer.style.height = '100px';
        outer.style.overflow = 'scroll';
        outer.style.position = 'absolute';
        outer.style.top = '-9999px';
        document.body.appendChild(outer);
        var inner = document.createElement('div');
        inner.style.width = '100%';
        inner.style.height = '100%';
        outer.appendChild(inner);
        var scrollbarWidth = outer.offsetWidth - outer.clientWidth;
        var scrollbarHeight = outer.offsetHeight - outer.clientHeight;
        document.body.removeChild(outer);
        window.__chat_scrollbar_size = { width: scrollbarWidth, height: scrollbarHeight };
        return window.__chat_scrollbar_size;
    }
})();