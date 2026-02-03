import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, Email, Form, Header } from "../../components/Auth"
import { requestPasswordReset } from "../../utils/api"

export default function ForgotPassword() {
    const { t } = useTranslation()

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
                    <p className="text-center text-zinc-300 light:text-zinc-600">{t("auth.forgotPassword.nextParagraph")}</p>
                    <Button
                        text={t("auth.goBackToLogin")}
                        isDisabled={false}
                        onClick={() => {
                            location.href = "/login"
                        }}
                    />
                </>
            ) : (
                <>
                    <p className="text-center text-zinc-300 light:text-zinc-600">{t("auth.forgotPassword.paragraph")}</p>
                    <Email email={email} setEmail={setEmail} />
                    <Button text={t("auth.forgotPassword.next")} isDisabled={email === ""} />
                </>
            )}
        </Form>
    )
}