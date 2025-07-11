import { useState } from "react"
import "./AuthPages.css"
import { signup } from "../auth"

export default function SignupPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        setError("")

        try {
            await signup(email, password)
            location.href = "/"
        } catch {
            setError("Email is already registered. Please choose another one")
        }
    }

    return (
        <form id="auth-form" onSubmit={handleSubmit}>
            <h1 id="title-h1">Sign up</h1>
            <input id="email-input" type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} required />
            {error && <p id="error-p">{error}</p>}
            <input id="password-input" type="password" placeholder="Password" value={password} minLength={12} onChange={event => setPassword(event.target.value)} required />
            <button id="submit-button">Sign up</button>
            <p>Already have an account? <a id="recommendation-a" href="/login">Log in!</a></p>
        </form>
    )
}