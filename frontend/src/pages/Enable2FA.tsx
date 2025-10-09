import { useEffect, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"

import { totpSetup, totpEnable } from "../utils/api"
import { buttonClassNames, formClassNames, inputClassNames } from "../components/Auth"

export default function Enable2FA() {
    const [otpauth, setOtpauth] = useState<string | null>(null)
    const [secret, setSecret] = useState<string | null>(null)
    const [code, setCode] = useState("")
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
    const [error, setError] = useState("")

    useEffect(() => {
        (async () => {
            const response = await totpSetup()
            if (response.ok) {
                const data = await response.json()
                setOtpauth(data.otpauth_url)
                setSecret(data.secret)
            } else {
                setError("Unable to start TOTP setup")
            }
        })()
    }, [])

    async function handleEnable(e: React.FormEvent) {
        e.preventDefault()
        const response = await totpEnable(code)
        if (response.ok) {
            const data = await response.json()
            setBackupCodes(data.backup_codes)
            alert("2FA enabled — copy your backup codes now and store them safely.")
        } else {
            setError("Invalid code")
        }
    }

    return (
        <div className="flex flex-col w-screen h-screen items-center justify-center text-xl text-white light:text-black bg-gray-900 light:bg-gray-300">
            <h1 className="text-2xl">Enable Two-Factor Authentication</h1>
            {otpauth && (
                <div className={formClassNames}>
                    <p>Scan this QR in your authenticator app (or use the secret below):</p>
                    <div className="my-4">
                        <QRCodeCanvas value={otpauth} />
                    </div>
                    <p>Secret: {secret}</p>
                    <form className="flex flex-col gap-3 w-[50%]" onSubmit={handleEnable}>
                        <input className={inputClassNames} value={code} onChange={e => setCode(e.target.value)} required placeholder="6-digit code" />
                        <button className={buttonClassNames}>Enable</button>
                    </form>
                    {error && <p className="text-red-600">{error}</p>}
                    {backupCodes && (
                        <div>
                            <h3>Backup codes</h3>
                            <p>Store these somewhere safe — each can be used once:</p>
                            <ul>{backupCodes.map(c => <li key={c} className="font-mono">{c}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}