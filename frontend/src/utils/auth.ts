import type { Theme, User } from "../types"

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
    await apiFetch("/api/logout/", { credentials: "include" })
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

export async function getCurrentUser(): Promise<User | null> {
    const response = await apiFetch("/api/me/", { credentials: "include" })
    if (!response.ok) {
        return null
    }
    return await response.json()
}

export async function setCurrentUser(theme?: Theme, hasSidebarOpen?: boolean): Promise<number> {
    const response = await apiFetch("/api/me/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, has_sidebar_open: hasSidebarOpen })
    })
    return response.status
}

export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    let response = await fetch(input, { ...init, credentials: "include" })

    if (response.status === 401) {
        const refreshResponse = await fetch("/api/refresh-token/", {
            method: "POST",
            credentials: "include"
        })

        if (refreshResponse.ok) {
            response = await fetch(input, { ...init, credentials: "include" })
        }
    }

    return response
}