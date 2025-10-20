import React, { useState } from "react"

import { Button, Email, Error, Form, Header, MFA, Password, Recommendation } from "../components/Auth"
import { login, verifyMFA } from "../utils/api"

export default function Login() {
    const [email, setEmail] = useState("user1@example.com")
    const [password, setPassword] = useState("user1password")
    const [preAuthToken, setPreAuthToken] = useState("")
    const [code, setCode] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        const response = await login(email, password)
        if (response.ok) {
            const data = await response.json()
            if (data.is_mfa_required) {
                setPreAuthToken(data.pre_auth_token)
            } else {
                location.href = "/"
            }
        } else {
            const data = await response.json()
            setError(data.error)
        }
    }

    async function handleMFASubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        const response = await verifyMFA(preAuthToken, code)
        if (response.ok) {
            location.href = "/"
        } else {
            const data = await response.json()
            setError(data.error)
        }
    }

    return (
        !preAuthToken ? (
            <Form handleSubmit={handleSubmit}>
                <Header text="Welcome back" />
                <Email email={email} setEmail={setEmail} />
                <Password password={password} setPassword={setPassword} label="Password" id="password" />
                {error && <Error text={error} />}
                <Button text="Log in" />
                <Recommendation text="Don't have an account?" url="/signup" urlText="Sign up!" />
            </Form>
        ) : (
            <Form handleSubmit={handleMFASubmit}>
                <Header text="Multi-Factor Authentication" />
                <p className="text-center text-gray-400 light:text-gray-600">Enter the 6-digit code from your authenticator app</p>
                <MFA
                    code={code}
                    onChange={e => {
                        setError("")
                        setCode(e.target.value)
                    }}
                />
                {error && <Error text={error} />}
                <Button text="Verify" />
            </Form>
        )
    )
}