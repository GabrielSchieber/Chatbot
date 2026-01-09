import { createContext, useContext, useEffect, useRef, useState } from "react"

import { authenticateAsGuest, me } from "../utils/api"
import type { User } from "../utils/types"

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const hasTriedToAuthenticate = useRef(false)

    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    async function tryToAuthenticateAsGuest() {
        const response = await authenticateAsGuest()
        if (response.ok) {
            const response = await me()
            if (response.ok) {
                setUser(await response.json())
                if (window.innerWidth < 750) {
                    await me(undefined, undefined, false)
                    setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: false } } : previous)
                }
                setLoading(false)
                return
            }
        }

        setUser(null)
        setLoading(false)

        throw Error("Authentication as guest failed.")
    }

    async function tryToAuthenticate() {
        const response = await me()
        if (response.ok) {
            setUser(await response.json())
            setLoading(false)
            return
        } else if (location.pathname === "/") {
            try {
                await tryToAuthenticateAsGuest()
                return
            } catch {
                location.href = "/login"
            }
        }

        setUser(null)
        setLoading(false)
    }

    useEffect(() => {
        if (!hasTriedToAuthenticate.current) {
            tryToAuthenticate()
            hasTriedToAuthenticate.current = true
        }
    }, [])

    return (
        <AuthContext.Provider value={{ user, setUser, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error("useAuth must be used inside AuthProvider")
    return context
}

interface AuthContextValue {
    user: User | null
    setUser: React.Dispatch<React.SetStateAction<User | null>>
    loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)