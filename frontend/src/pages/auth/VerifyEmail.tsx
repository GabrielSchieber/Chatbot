import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button, Error, Header } from "../../components/Auth"
import { useNotify } from "../../providers/NotificationProvider"
import { me, verifyEmail } from "../../utils/api"

export default function VerifyEmail() {
    const { t } = useTranslation()

    const notify = useNotify()

    const shouldVerify = useRef(true)

    const [error, setError] = useState("")

    const params = new URLSearchParams(location.search)
    const email = params.get("email")
    const token = params.get("token")

    async function verify() {
        if (!shouldVerify.current || !email || !token) return
        shouldVerify.current = false

        const response = await verifyEmail(email, token)
        if (response.ok) {
            if (window.innerWidth < 750) {
                await me(undefined, undefined, false)
            }
            location.href = "/"
        } else if (response.status === 429) {
            notify(t("throttled"), "error")
        } else {
            setError("auth.verifyEmail.error")
        }
    }

    useEffect(() => { verify() }, [])

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 light:bg-zinc-50">
            <div
                className="
                    flex flex-col w-full max-w-md p-8 space-y-4 items-center rounded-2xl
                    border border-zinc-800 light:border-zinc-200 shadow-2xl bg-zinc-900 light:bg-zinc-100
                "
            >
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
                    <p className="text-center text-zinc-400 light:text-zinc-500">{t("auth.verifyEmail.paragraph")}</p>
                )}
            </div>
        </div>
    )
}