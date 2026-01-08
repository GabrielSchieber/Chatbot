import { t } from "i18next"
import { useEffect, useState } from "react"

import { Button, Error, Header } from "../../components/Auth"
import { me, verifyEmail } from "../../utils/api"

export default function VerifyEmail() {
    const [error, setError] = useState("")
    const params = new URLSearchParams(location.search)

    const email = params.get("email")
    const token = params.get("token")

    async function verify() {
        if (!email || !token) return

        const response = await verifyEmail(email, token)
        if (response.ok) {
            if (window.innerWidth < 750) {
                await me(undefined, undefined, false)
            }
            location.href = "/"
        } else {
            setError("auth.verifyEmail.error")
        }
    }

    useEffect(() => { verify() }, [])

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 light:bg-gray-100">
            <div className="flex flex-col w-full max-w-md p-8 space-y-4 items-center rounded-lg shadow-xl bg-gray-800 light:bg-white">
                <Header text={t("auth.verifyEmail.header")} />
                {error ? (
                    <>
                        <Error text={t(error)} />
                        <Button
                            text={t("auth.goBackToLogin")}
                            isDisabled={false}
                            onClick={() => {
                                location.href = "/login"
                            }}
                        />
                    </>
                ) : (
                    <p className="text-center text-gray-300 light:text-gray-600">{t("auth.verifyEmail.paragraph")}</p>
                )}
            </div>
        </div>
    )
}