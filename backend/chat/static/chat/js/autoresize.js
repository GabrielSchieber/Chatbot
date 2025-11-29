(function () {
    function autoResize(element) {
        if (!element) {
            return
        }

        element.style.height = "auto"
        const newHeight = element.scrollHeight
        try {
            const scrollbarSize = getScrollbarSize()
            if (element.scrollWidth > element.clientWidth) {
                newHeight += scrollbarSize.height || 0
            }
        } catch { }
        element.style.height = (newHeight + 2) + "px"
    }

    function setupTextArea(textArea) {
        if (!textArea) {
            return
        }

        textArea.style.resize = "none"
        textArea.style.overflow = "hidden"
        textArea.style.boxSizing = "border-box"
        autoResize(textArea)
        textArea.addEventListener("input", () => autoResize(textArea), false)
        textArea.style.overflowX = "auto"
        textArea.style.overflowY = "hidden"
        textArea.wrap = "off"
        textArea.style.whiteSpace = "pre"
    }

    function setupAll() {
        document.querySelectorAll("textarea.chat-autoresize").forEach(textArea => setupTextArea(textArea))
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupAll)
    } else {
        setupAll()
    }

    document.addEventListener("formset:added", event => {
        try {
            const form = event && event.detail && event.detail.form
            if (form) {
                form.querySelectorAll && form.querySelectorAll("textarea.chat-autoresize").forEach(textArea => setupTextArea(textArea))
                return
            }
        } catch (e) { }
        setTimeout(setupAll, 0)
    })

    try {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes && mutation.addedNodes.forEach(node => {
                    if (node && node.querySelectorAll) {
                        node.querySelectorAll("textarea.chat-autoresize").forEach(textArea => setupTextArea(textArea))
                        if (node.tagName === "TEXTAREA" && node.classList && node.classList.contains("chat-autoresize")) {
                            setupTextArea(node)
                        }
                    }
                })
            })
        })
        observer.observe(document.body, { childList: true, subtree: true })
    } catch { }

    function getScrollbarSize() {
        if (window.__chat_scrollbar_size) return window.__chat_scrollbar_size
        const outer = document.createElement("div")
        outer.style.visibility = "hidden"
        outer.style.width = "100px"
        outer.style.height = "100px"
        outer.style.overflow = "scroll"
        outer.style.position = "absolute"
        outer.style.top = "-9999px"
        document.body.appendChild(outer)
        const inner = document.createElement("div")
        inner.style.width = "100%"
        inner.style.height = "100%"
        outer.appendChild(inner)
        const scrollbarWidth = outer.offsetWidth - outer.clientWidth
        const scrollbarHeight = outer.offsetHeight - outer.clientHeight
        document.body.removeChild(outer)
        window.__chat_scrollbar_size = { width: scrollbarWidth, height: scrollbarHeight }
        return window.__chat_scrollbar_size
    }
})()