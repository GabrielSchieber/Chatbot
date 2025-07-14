import { useEffect, useState } from "react"

export async function login(email: string, password: string) {
    const response = await fetch("/api/login/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
    })
    if (!response.ok) {
        throw Error("Login was not possible")
    }
}

export async function logout() {
    await fetch("/api/logout/", { method: "POST", credentials: "include" })
}

export async function signup(email: string, password: string) {
    const response = await fetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
    })

    if (response.ok) {
        try {
            await login(email, password)
        } catch {
            throw new Error("Log in after sign up was not possible.")
        }
    } else {
        throw new Error("Sign up was not possible.")
    }
}

export function useAuth() {
    const [user, setUser] = useState<null | { id: number, email: string }>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCurrentUser().then(user => {
            setUser(user)
            setLoading(false)
        })
    }, [])

    return { user, loading, isLoggedIn: !!user }
}

async function getCurrentUser(): Promise<{ id: number; email: string } | null> {
    const response = await fetch("/api/me/", { credentials: "include" })
    if (!response.ok) {
        return null
    }
    return await response.json()
}