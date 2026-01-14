import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { Button, Error, Form, Header, Password } from "../../components/Auth"
import { confirmPasswordReset } from "../../utils/api"

export default function ResetPassword() {
    const { t } = useTranslation()

    const token = new URLSearchParams(location.search).get("token")

    if (!token) {
        location.href = "/login"
        return
    }

    const navigate = useNavigate()

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isChanging, setIsChanging] = useState(false)
    const [isDone, setIsDone] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if (!token) return

        if (password !== confirmPassword) {
            setError("auth.resetPassword.passwordsDoNotMatch")
            return
        }

        setIsChanging(true)

        const response = await confirmPasswordReset(token, password)
        if (response.ok) {
            setIsDone(true)
        } else {
            setError((await response.json()).detail)
        }
    }

    useEffect(() => {
        if (error !== "auth.resetPassword.invalid") {
            setError("")
        }
    }, [password, confirmPassword])

    return (
        <Form handleSubmit={handleSubmit}>
            <Header text={t("auth.resetPassword.header")} />
            {isDone ? (
                <>
                    <p className="font-semibold text-center text-white light:text-black">{t("auth.resetPassword.success")}</p>
                    <Button text={t("auth.goBackToLogin")} isDisabled={false} onClick={() => navigate("/login")} />
                </>
            ) : (
                <>
                    <Password
                        password={password}
                        setPassword={setPassword}
                        label={t("auth.resetPassword.password")}
                        id="password"
                        minLength={12}
                        maxLength={1000}
                    />
                    <Password
                        password={confirmPassword}
                        setPassword={setConfirmPassword}
                        label={t("auth.resetPassword.confirmPassword")}
                        id="confirm-password"
                    />
                    {error.includes("passwordsDoNotMatch") &&
                        <Error text={t(error)} />
                    }
                    <Button
                        text={t(`auth.resetPassword.${error.includes("invalid") ? "failed" : isChanging ? "changing" : "confirm"}`)}
                        isDisabled={isChanging}
                    />
                    {!error.includes("passwordsDoNotMatch") &&
                        <Error text={t(error)} />
                    }
                </>
            )}
        </Form>
    )
}