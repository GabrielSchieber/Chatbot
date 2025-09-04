import { createContext, useContext, useEffect, useState } from "react"
import type { Theme } from "../types"
import { applyTheme } from "../utils/theme"
import { setTheme as setThemeAPI } from "../utils/api"
import { useAuth } from "../utils/auth"

interface ThemeContextValue {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    const [theme, setThemeState] = useState<Theme>(user?.theme || "System")

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