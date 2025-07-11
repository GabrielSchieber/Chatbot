import { useState } from "react"
import "./AuthPages.css"
import { login } from "../auth"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        setError("")

        try {
            await login(email, password)
            location.href = "/"
        } catch {
            setError("Email and/or password are invalid.")
        }
    }

    return (
        <form id="auth-form" onSubmit={handleSubmit}>
            <h1 id="title-h1">Log in</h1>
            <input id="email-input" type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} required />
            <input id="password-input" type="password" placeholder="Password" value={password} onChange={event => setPassword(event.target.value)} required />
            {error && <p id="error-p">{error}</p>}
            <button id="submit-button">Login</button>
            <p>Don't have an account? <a id="recommendation-a" href="/signup">Sign up!</a></p>
        </form>
    )
}