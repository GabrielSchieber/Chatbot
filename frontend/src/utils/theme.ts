import type { Theme } from "../types"

export function applyTheme(theme: Theme) {
    const root = document.documentElement

    root.classList.remove("Light", "Dark")

    if (theme === "System") {
        root.classList.add(matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light")
    } else {
        root.classList.add(theme)
    }
}