import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "../types"
import { getCurrentUser } from "../utils/api"

interface AuthContextValue {
    user: User | null
    loading: boolean
    isLoggedIn: boolean
}

const ThemeContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCurrentUser().then(user => {
            setUser(user)
            setLoading(false)
        })
    }, [])

    return (
        <ThemeContext.Provider value={{ user, loading, isLoggedIn: user !== null }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(ThemeContext)
    if (!context) throw new Error("useAuth must be used inside AuthProvider")
    return context
}