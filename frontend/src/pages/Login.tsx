import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, Email, Error, Form, Header, MFA, MFARecovery, MFAStepSwitch, Password, Recommendation, type Step } from "../components/Auth"
import { login, verifyMFA } from "../utils/api"

export default function Login() {
    const { t } = useTranslation()

    const [step, setStep] = useState<Step>("login")

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const [token, setToken] = useState("")
    const [code, setCode] = useState("")

    const [error, setError] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError("")
        setIsVerifying(true)

        const response = await login(email, password)
        if (response.ok) {
            const data = await response.json().catch(() => { return {} })
            if (data.token) {
                setStep("mfa")
                setToken(data.token)
                setIsVerifying(false)
            } else {
                location.href = "/"
            }
        } else {
            const data = await response.json()
            setError(t(data.detail))
            setToken("")
            setIsVerifying(false)
        }
    }

    async function handleMFASubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsVerifying(true)

        const response = await verifyMFA(token, code)
        if (response.ok) {
            location.href = "/"
        } else {
            const data = await response.json()
            setError(t(data.detail))
            setToken("")
            setIsVerifying(false)
        }
    }

    return (
        step === "login" ? (
            <Form handleSubmit={handleSubmit}>
                <Header text={t("login.header")} />
                <Email email={email} setEmail={setEmail} />
                <Password
                    password={password}
                    setPassword={setPassword}
                    label={t("login.password")}
                    id="password"
                    includeForgotPassword={true}
                />
                {error && <Error text={error} />}
                <Button text={isVerifying ? t("login.loggingIn") : t("login.logIn")} isDisabled={isVerifying} />
                <Recommendation text={t("login.noAccount")} url="/signup" urlText={t("login.signUp")} />

            </Form>
        ) : step === "mfa" ? (
            <Form handleSubmit={handleMFASubmit}>
                <Header text={t("login.mfa.header")} />
                <p className="text-center text-gray-400 light:text-gray-600">{t("login.mfa.description")}</p>
                <MFA code={code} setCode={setCode} setError={setError} />
                {error && <Error text={error} />}
                <Button text={isVerifying ? t("login.mfa.verifying") : t("login.mfa.verify")} isDisabled={isVerifying} />
                <MFAStepSwitch
                    text={t("login.mfa.useRecovery")}
                    switchStep="mfa-recovery"
                    setStep={setStep}
                    setCode={setCode}
                    setError={setError}
                    isDisabled={isVerifying}
                />
            </Form>
        ) : (
            <Form handleSubmit={handleMFASubmit}>
                <Header text={t("login.mfaRecovery.header")} />
                <p className="text-center text-gray-400 light:text-gray-600">{t("login.mfaRecovery.description")}</p>
                <MFARecovery code={code} setCode={setCode} setError={setError} />
                {error && <Error text={error} />}
                <Button text={isVerifying ? t("login.mfa.verifying") : t("login.mfa.verify")} isDisabled={isVerifying} />
                <MFAStepSwitch
                    text={t("login.mfaRecovery.useAuthenticator")}
                    switchStep="mfa"
                    setStep={setStep}
                    setCode={setCode}
                    setError={setError}
                    isDisabled={isVerifying}
                />
            </Form>
        )
    )
}