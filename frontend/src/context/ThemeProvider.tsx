import { createContext, useContext, useEffect, useState } from "react"
import { type Theme, getStoredTheme, storeTheme, applyTheme } from "../utils/theme"

interface ThemeContextValue {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme)

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        storeTheme(newTheme)
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