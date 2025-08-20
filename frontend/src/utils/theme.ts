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

    if (theme === "system") {
        root.classList.add(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    } else {
        root.classList.add(theme)
    }
}