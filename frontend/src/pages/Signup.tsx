import { t } from "i18next"
import React, { useEffect, useState } from "react"

import { Button, Email, Error, Form, Header, Password, Recommendation } from "../components/Auth"
import { useNotify } from "../providers/NotificationProvider"
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
                notify(t("signup.error"), "error")
                setIsVerifying(false)
            }
        } else {
            const data = await response.json()
            setError(data.error)
            setIsVerifying(false)
        }
    }

    useEffect(() => setError(""), [email, password, confirmPassword])

    return (
        <Form handleSubmit={handleSubmit}>
            <Header text={t("signup.header")} />
            <Email email={email} setEmail={setEmail} />
            <Password
                password={password}
                setPassword={setPassword}
                label={t("signup.password")}
                id="password"
                minLength={12}
                maxLength={1000}
            />
            <Password
                password={confirmPassword}
                setPassword={setConfirmPassword}
                label={t("signup.confirmPassword")}
                id="confirm-password"
            />
            {error && <Error text={error} />}
            <Button text={isVerifying ? t("signup.signingUp") : t("signup.signUp")} isDisabled={isVerifying} />
            <Recommendation text={t("signup.haveAccount")} url="/login" urlText={t("signup.logIn")} />
        </Form>
    )
}