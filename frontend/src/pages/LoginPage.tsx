import { useState } from "react"
import { login } from "../utils/auth"

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
        <div className="flex flex-col w-screen h-screen bg-gray-900 items-center justify-center">
            <form
                className="flex flex-col gap-3 w-[500px] p-4 items-center justify-center rounded-xl bg-gray-800"
                onSubmit={handleSubmit}
            >
                <h1 className="text-white text-2xl pb-4">Log in</h1>
                <input
                    className="text-white text-xl outline-none w-full bg-gray-700 rounded-xl px-3 py-2"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    onKeyDown={_ => setError("")}
                    required
                />
                <input
                    className="text-white text-xl outline-none w-full bg-gray-700 rounded-xl px-3 py-2"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    onKeyDown={_ => setError("")}
                    required
                />
                {error && <p className="text-red text-xl">{error}</p>}
                <button className="text-white text-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-700 rounded-xl px-6 py-1">Login</button>
                <p className="text-white text-xl">Don't have an account? <a className="text-white text-xl hover:underline" href="/signup">Sign up!</a></p>
            </form>
        </div>
    )
}