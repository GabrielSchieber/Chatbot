import React, { useState } from "react"

import { Button, Email, Error, Form, Header, Password, Recommendation } from "../components/Auth"
import { useNotify } from "../context/NotificationProvider"
import { login, signup } from "../utils/api"

export default function Signup() {
    const notify = useNotify()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const [error, setError] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsVerifying(true)

        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            setIsVerifying(false)
            return
        }

        const response = await signup(email, password)
        if (response.ok) {
            const response = await login(email, password)
            if (response.ok) {
                location.href = "/"
            } else {
                notify("An error occurred. Please try again later.", "error")
                setIsVerifying(false)
            }
        } else {
            const data = await response.json()
            setError(data.error)
            setIsVerifying(false)
        }
    }

    return (
        <Form handleSubmit={handleSubmit}>
            <Header text="Create your account" />
            <Email email={email} setEmail={setEmail} />
            <Password
                password={password}
                setPassword={setPassword}
                label="Password"
                id="password"
                minLength={12}
                maxLength={100}
            />
            <Password
                password={confirmPassword}
                setPassword={setConfirmPassword}
                label="Confirm Password"
                id="confirm-password"
            />
            {error && <Error text={error} />}
            <Button text={isVerifying ? "Signing up" : "Sign up"} isDisabled={isVerifying} />
            <Recommendation text="Already have an account?" url="/login" urlText="Log in!" />
        </Form>
    )
}