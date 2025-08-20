import { useState } from "react"
import { login, signup } from "../utils/auth"

export default function AuthPage({ type }: { type: "Signup" | "Login" }) {
    const submitFunction = type === "Signup" ? signup : login
    const submitError = type === "Signup" ? "Email is already registered. Please choose another one." : "Email and/or password are invalid."
    const headerText = type === "Signup" ? "Sign up" : "Log in"
    const recommendationText = type === "Signup" ? "Already have an account?" : "Don't have an account?"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        setError("")

        try {
            await submitFunction(email, password)
            location.href = "/"
        } catch {
            setError(submitError)
        }
    }

    return (
        <div className="flex flex-col w-screen h-screen bg-gray-900 items-center justify-center">
            <form
                className="flex flex-col gap-3 w-[500px] p-4 items-center justify-center rounded-xl bg-gray-800"
                onSubmit={handleSubmit}
            >
                <h1 className="text-white text-2xl pb-4">{headerText}</h1>
                <input
                    className="text-white text-xl outline-none w-full bg-gray-700 rounded-xl px-3 py-2"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={_ => setError("")}
                    required
                />
                {type === "Signup" && error && <p className="text-red-600 text-lg">{error}</p>}
                <input
                    className="text-white text-xl outline-none w-full bg-gray-700 rounded-xl px-3 py-2"
                    type="password"
                    placeholder="Password"
                    value={password}
                    minLength={type === "Signup" ? 12 : undefined}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {type === "Login" && error && <p className="text-red-600 text-lg">{error}</p>}
                <button className="text-white text-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-700 rounded-xl px-6 py-1">{headerText}</button>
                <p className="text-white text-xl">
                    {recommendationText + " "}
                    <a className="text-white text-xl underline" href={type === "Signup" ? "/login" : "/signup"}>
                        {type === "Signup" ? "Log in!" : "Sign up!"}
                    </a>
                </p>
            </form>
        </div>
    )
}