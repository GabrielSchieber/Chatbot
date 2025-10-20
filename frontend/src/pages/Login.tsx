import React, { useState } from "react"

import { Button, Email, Error, Form, Header, Password, Recommendation } from "../components/Auth"
import { login } from "../utils/api"

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        const response = await login(email, password)
        if (response.ok) {
            location.href = "/"
        } else {
            const data = await response.json()
            setError(data.error)
        }
    }

    return (
        <Form handleSubmit={handleSubmit}>
            <Header text="Welcome back" />
            <Email email={email} setEmail={setEmail} />
            <Password password={password} setPassword={setPassword} label="Password" id="password" />
            {error && <Error text={error} />}
            <Button text="Log in" />
            <Recommendation text="Don't have an account?" url="/signup" urlText="Sign up!" />
        </Form>
    )
}