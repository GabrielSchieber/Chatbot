import { t } from "i18next"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Button, Email, Form, Header } from "../../components/Auth"
import { requestPasswordReset } from "../../utils/api"

export default function ForgotPassword() {
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [hasSent, setHasSent] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setHasSent(true)
        await requestPasswordReset(email)
    }

    return (
        <Form handleSubmit={handleSubmit}>
            <Header text={t("auth.forgotPassword.header")} />
            {hasSent ? (
                <>
                    <p className="text-center text-gray-300 light:text-gray-600">{t("auth.forgotPassword.nextParagraph")}</p>
                    <Button text={t("auth.goBackToLogin")} isDisabled={false} onClick={() => navigate("/login")} />
                </>
            ) : (
                <>
                    <p className="text-center text-gray-300 light:text-gray-600">{t("auth.forgotPassword.paragraph")}</p>
                    <Email email={email} setEmail={setEmail} />
                    <Button text={t("auth.forgotPassword.next")} isDisabled={email === ""} />
                </>
            )}
        </Form>
    )
}