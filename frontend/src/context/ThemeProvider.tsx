import { createContext, useContext, useEffect, useState } from "react"
import type { Theme } from "../types"
import { applyTheme } from "../utils/theme"
import { getTheme as getThemeAPI, setTheme as setThemeAPI } from "../utils/api"

interface ThemeContextValue {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("System")
    getThemeAPI().then(theme => setThemeState(theme))

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        setThemeAPI(newTheme)
        applyTheme(newTheme)
    }

    useEffect(() => {
        applyTheme(theme)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
    return ctx
}