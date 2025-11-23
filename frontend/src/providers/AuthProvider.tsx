import { createContext, useContext, useEffect, useState } from "react"

import { me } from "../utils/api"
import type { User } from "../utils/types"

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        me().then(async response => {
            if (response.ok) {
                const data = await response.json()
                setUser(data)
                setLoading(false)
            } else {
                setUser(null)
                setLoading(false)
            }
        })
    }, [])

    return (
        <AuthContext.Provider value={{ user, setUser, loading, isLoggedIn: user !== null }}>
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
    isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)