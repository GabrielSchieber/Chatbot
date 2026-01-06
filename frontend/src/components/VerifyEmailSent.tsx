import { t } from "i18next"

import { Button, Header } from "./Auth"

export default function VerifyEmailSent() {
    const email = new URLSearchParams(location.search).get("email")

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 light:bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-4 rounded-lg shadow-xl bg-gray-800 light:bg-white">
                <Header text={t("auth.verifyEmailSent.header")} />
                <div>
                    <p className="text-white light:text-black">{t("auth.verifyEmailSent.firstParagraph", { email })}</p>
                    <p className="text-white light:text-black">{t("auth.verifyEmailSent.secondParagraph")}</p>
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