import { useState } from "react"

import { login, signup, verifyMFA } from "../utils/api"

export const formClassNames = "flex flex-col gap-3 p-4 items-center justify-center rounded-xl bg-gray-800 light:bg-gray-100"
export const inputClassNames = "outline-none w-full bg-gray-700 light:bg-gray-200 rounded-xl px-3 py-2"
export const buttonClassNames = "bg-gray-700 light:bg-gray-300 hover:bg-gray-600 light:hover:bg-gray-400 rounded-xl px-6 py-1 cursor-pointer"

export default function Auth({ type }: { type: "Signup" | "Login" }) {
    const submitFunction = type === "Signup" ? signup : login
    const submitError = type === "Signup" ? "Email is already registered. Please choose another one." : "Email and/or password are invalid."
    const headerText = type === "Signup" ? "Sign up" : "Log in"
    const recommendationText = type === "Signup" ? "Already have an account?" : "Don't have an account?"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const [showMFA, setShowMFA] = useState(false)
    const [preAuthToken, setPreAuthToken] = useState<string | null>(null)
    const [mFACode, setMFACode] = useState("")

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        setError("")

        const response = await submitFunction(email, password)
        if (response.ok) {
            if (type === "Signup") {
                const response = await login(email, password)
                if (response.ok) {
                    location.href = "/"
                } else {
                    alert("Error logging in after sign up")
                }
            } else {
                const data = await response.json().catch(() => ({}))
                if (data.is_mfa_required) {
                    setPreAuthToken(data.pre_auth_token)
                    setShowMFA(true)
                    return
                }
                if (response.ok) location.href = "/"
                else setError(submitError)
            }
        } else {
            setError(submitError)
        }
    }

    async function handleVerifyMFA(event: React.FormEvent) {
        event.preventDefault()
        if (!preAuthToken) return

        const response = await verifyMFA(preAuthToken, mFACode)
        if (response.ok) {
            location.href = "/"
        } else {
            setError("Invalid 2FA code")
        }
    }

    return (
        <div className="flex flex-col w-screen h-screen items-center justify-center text-xl text-white light:text-black bg-gray-900 light:bg-gray-300">
            {!showMFA ? (
                <form className={formClassNames + " w-[500px]"} onSubmit={handleSubmit}>
                    <h1 className="text-2xl pb-4">{headerText}</h1>
                    <input
                        className={inputClassNames}
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={_ => setError("")}
                        required
                    />
                    {type === "Signup" && error && <p className="text-red-600 text-lg">{error}</p>}
                    <input
                        className={inputClassNames}
                        type="password"
                        placeholder="Password"
                        value={password}
                        minLength={type === "Signup" ? 12 : undefined}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                    {type === "Login" && error && <p className="text-red-600 text-lg">{error}</p>}
                    <button className={buttonClassNames}>
                        {headerText}
                    </button>
                    <p className="text-xl">
                        {recommendationText + " "}
                        <a className="underline" href={type === "Signup" ? "/login" : "/signup"}>
                            {type === "Signup" ? "Log in!" : "Sign up!"}
                        </a>
                    </p>
                </form>
            ) : (
                <form className={formClassNames} onSubmit={handleVerifyMFA}>
                    <h2 className="mb-2">Two-factor authentication</h2>
                    <input
                        className={inputClassNames}
                        value={mFACode}
                        onChange={e => {
                            setError("")
                            setMFACode(e.target.value)
                        }}
                        placeholder="Enter 6-digit code"
                        required
                    />
                    <button className={buttonClassNames}>Verify</button>
                    {error && <p className="text-red-600">{error}</p>}
                </form>
            )}
        </div>
    )
}