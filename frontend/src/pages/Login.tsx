import React, { useState } from "react"

import { Button, Email, Error, Form, Header, MFA, MFARecovery, MFAStepSwitch, Password, Recommendation, type Step } from "../components/Auth"
import { login, verifyMFA } from "../utils/api"

export default function Login() {
    const [step, setStep] = useState<Step>("login")

    const [email, setEmail] = useState("user1@example.com")
    const [password, setPassword] = useState("user1password")

    const [mfaToken, setMFAToken] = useState("")
    const [mfaCode, setMFACode] = useState("")

    const [error, setError] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsVerifying(true)

        const response = await login(email, password)
        if (response.ok) {
            const data = await response.json()
            if (data.is_mfa_required) {
                setStep("mfa")
                setMFAToken(data.pre_auth_token)
                setIsVerifying(false)
            } else {
                location.href = "/"
            }
        } else {
            const data = await response.json()
            setError(data.error)
            setIsVerifying(false)
        }
    }

    async function handleMFASubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsVerifying(true)

        const response = await verifyMFA(mfaToken, mfaCode)
        if (response.ok) {
            location.href = "/"
        } else {
            const data = await response.json()
            setError(data.error)
            setIsVerifying(false)
        }
    }

    return (
        step === "login" ? (
            <Form handleSubmit={handleSubmit}>
                <Header text="Welcome back" />
                <Email email={email} setEmail={setEmail} />
                <Password password={password} setPassword={setPassword} label="Password" id="password" />
                {error && <Error text={error} />}
                <Button text={isVerifying ? "Logging in" : "Log in"} isDisabled={isVerifying} />
                <Recommendation text="Don't have an account?" url="/signup" urlText="Sign up!" />
            </Form>
        ) : step === "mfa" ? (
            <Form handleSubmit={handleMFASubmit}>
                <Header text="Multi-Factor Authentication" />
                <p className="text-center text-gray-400 light:text-gray-600">Enter the 6-digit code from your authenticator app</p>
                <MFA code={mfaCode} setCode={setMFACode} setError={setError} />
                {error && <Error text={error} />}
                <Button text={isVerifying ? "Verifying" : "Verify"} isDisabled={isVerifying} />
                <MFAStepSwitch
                    text="Use recovery code"
                    switchStep="mfa-recovery"
                    setStep={setStep}
                    setCode={setMFACode}
                    setError={setError}
                    isDisabled={isVerifying}
                />
            </Form>
        ) : (
            <Form handleSubmit={handleMFASubmit}>
                <Header text="Recover Multi-Factor Authentication" />
                <p className="text-center text-gray-400 light:text-gray-600">Enter one of your recovery code</p>
                <MFARecovery code={mfaCode} setCode={setMFACode} setError={setError} />
                {error && <Error text={error} />}
                <Button text={isVerifying ? "Verifying" : "Verify"} isDisabled={isVerifying} />
                <MFAStepSwitch
                    text="Use authenticator code"
                    switchStep="mfa"
                    setStep={setStep}
                    setCode={setMFACode}
                    setError={setError}
                    isDisabled={isVerifying}
                />
            </Form>
        )
    )
}