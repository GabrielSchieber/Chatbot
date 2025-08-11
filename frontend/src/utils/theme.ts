export type Theme = "system" | "light" | "dark"

const THEME_KEY = "theme"

export function getStoredTheme(): Theme {
    return (localStorage.getItem(THEME_KEY) as Theme) || "system"
}

export function storeTheme(theme: Theme) {
    localStorage.setItem(THEME_KEY, theme)
}

export function applyTheme(theme: Theme) {
    const root = document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "light") root.classList.add("light")
    else if (theme === "dark") root.classList.add("dark")

    updateCodeTheme(theme)
}

function updateCodeTheme(theme: Theme) {
    let link = document.getElementById("code-block-theme-link") as HTMLLinkElement
    if (!link) {
        link = document.createElement("link")
        link.id = "code-block-theme-link"
        link.rel = "stylesheet"
        document.head.appendChild(link)
    }
    link.href =
        theme === "light"
            ? "/code_light.css"
            : theme === "dark"
                ? "/code_dark.css"
                : matchMedia("(prefers-color-scheme: dark)").matches
                    ? "/code_dark.css"
                    : "/code_light.css"
}