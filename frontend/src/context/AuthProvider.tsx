import { createContext, useContext, useEffect, useState } from "react"

import { me } from "../utils/api"
import type { User } from "../types"

interface AuthContextValue {
    user: User | null
    loading: boolean
    isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        me().then(response => {
            if (response.ok) {
                response.json().then(data => {
                    setUser(data)
                    setLoading(false)
                })
            } else {
                setUser(null)
                setLoading(false)
            }
        })
    }, [])

    return (
        <AuthContext.Provider value={{ user, loading, isLoggedIn: user !== null }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error("useAuth must be used inside AuthProvider")
    return context
}