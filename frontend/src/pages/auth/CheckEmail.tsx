import { useTranslation } from "react-i18next"

import { Button, Header } from "../../components/Auth"

export default function CheckEmail() {
    const { t } = useTranslation()

    const email = new URLSearchParams(location.search).get("email")

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 light:bg-zinc-50">
            <div className="w-full max-w-md p-8 space-y-4 rounded-2xl border border-zinc-800 light:border-zinc-200 shadow-2xl bg-zinc-900 light:bg-zinc-100">
                <Header text={t("auth.verifyEmailSent.header")} />
                <div>
                    <p className="text-zinc-100 light:text-zinc-900">{t("auth.verifyEmailSent.firstParagraph", { email })}</p>
                    <p className="text-zinc-100 light:text-zinc-900">{t("auth.verifyEmailSent.secondParagraph")}</p>
                </div>
                <Button
                    text={t("auth.goBackToLogin")}
                    isDisabled={false}
                    onClick={() => {
                        location.href = "/login"
                    }}
                />
            </div>
        </div>
    )
}