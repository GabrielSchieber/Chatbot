export async function login(email: string, password: string) {
    const response = await fetch("/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password: password })
    })

    if (response.ok) {
        const data = await response.json()
        localStorage.setItem("access_token", data.access)
        localStorage.setItem("refresh_token", data.refresh)
    } else {
        throw new Error("Log in was not possible.")
    }
}

export async function logout() {
    const response = await fetch("/api/logout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: localStorage.getItem("refresh_token") })
    })

    if (response.ok) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
    } else {
        throw new Error("Log out was not possible.")
    }
}

export async function signup(email: string, password: string) {
    const response = await fetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password: password })
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

export function isLoggedIn() {
    return !!localStorage.getItem("access_token")
}