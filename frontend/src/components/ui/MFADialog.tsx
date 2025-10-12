import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import { QRCodeCanvas } from "qrcode.react"
import { Dialog } from "radix-ui"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

import { buttonClassNames, inputClassNames } from "../Auth"
import { useAuth } from "../../context/AuthProvider"
import { disableMFA, enableMFA, setupMFA } from "../../utils/api"

export default function MFADialog({ triggerClassName }: { triggerClassName: string }) {
    const { user, setUser } = useAuth()
    if (!user) return <></>

    const [step, setStep] = useState<Step>(user.has_mfa_enabled ? "disable" : "generate")
    const [mFAAuthURL, setMFAAuthURL] = useState("")
    const [secret, setSecret] = useState("")
    const [backupCodes, setBackupCodes] = useState<string[]>([])

    useEffect(() => {
        setUser(previous =>
            previous && (step === "enabled" || step === "disabled") ?
                ({ ...previous, has_mfa_enabled: step === "enabled" })
                : previous
        )
    }, [step])

    return (
        <Dialog.Root onOpenChange={_ => setStep(user.has_mfa_enabled ? "disable" : "generate")}>
            <Dialog.Trigger className={triggerClassName}>
                {user.has_mfa_enabled ? "Disable" : "Enable"}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed flex flex-col gap-3 p-4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <Dialog.Title className="text-xl font-bold">
                        Manage multi-factor authentication
                    </Dialog.Title>

                    {(() => {
                        switch (step) {
                            case "generate":
                                return <GenerateDialog setMFAAuthURL={setMFAAuthURL} setSecret={setSecret} setStep={setStep} />
                            case "enable":
                                return <EnableDialog mFAAuthURL={mFAAuthURL} secret={secret} setBackupCodes={setBackupCodes} setStep={setStep} />
                            case "enabled":
                                return <EnabledDialog backupCodes={backupCodes} />
                            case "disable":
                                return <DisableDialog setStep={setStep} />
                            case "disabled":
                                return <DisabledDialog />
                        }
                    })()}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

type Step = "generate" | "enable" | "enabled" | "disable" | "disabled"

function GenerateDialog({ setMFAAuthURL, setSecret, setStep }: {
    setMFAAuthURL: Dispatch<SetStateAction<string>>
    setSecret: Dispatch<SetStateAction<string>>
    setStep: Dispatch<SetStateAction<Step>>
}) {
    const [error, setError] = useState("")

    async function handleSetup() {
        const response = await setupMFA()
        if (response.ok) {
            const data = await response.json()
            setMFAAuthURL(data.mfa_auth_url)
            setSecret(data.secret)
            setStep("enable")
        } else {
            setError("There was an error generating QR and secret codes")
        }
    }

    return (
        <div className="flex flex-col gap-1 items-center">
            <button className={buttonClassNames} onClick={handleSetup}>
                Generate QR and secret codes
            </button>
            {error && <p>{error}</p>}
        </div>
    )
}

function EnableDialog({ mFAAuthURL, secret, setBackupCodes, setStep }: {
    mFAAuthURL: string
    secret: string
    setBackupCodes: Dispatch<SetStateAction<string[]>>
    setStep: Dispatch<SetStateAction<Step>>
}) {
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [isCopyButtonChecked, setIsCopyButtonChecked] = useState(false)

    async function handleEnable(e: React.FormEvent) {
        e.preventDefault()
        const response = await enableMFA(code)
        if (response.ok) {
            const data = await response.json()
            setBackupCodes(data.backup_codes)
            setStep("enabled")
        } else {
            setError("Invalid code")
        }
    }

    return (
        <div className="flex flex-col gap-2 items-center">
            <p>Scan this QR in your authenticator app (or use the secret below):</p>
            <div className="my-3">
                <QRCodeCanvas value={mFAAuthURL} />
            </div>
            <div className="flex gap-2 px-2 py-0.5 items-center justify-center rounded bg-gray-700 light:bg-gray-300">
                <p>Secret: {secret}</p>
                <button
                    className="p-1 rounded cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                    onClick={_ => {
                        navigator.clipboard.writeText(secret)
                        setIsCopyButtonChecked(true)
                        setTimeout(() => setIsCopyButtonChecked(false), 2000)
                    }}
                >
                    {isCopyButtonChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                </button>
            </div>
            <form className="flex flex-col gap-2 items-center" onSubmit={handleEnable}>
                <input className={inputClassNames} value={code} onChange={e => setCode(e.target.value)} required placeholder="6-digit code" />
                <button className={buttonClassNames}>Enable</button>
            </form>
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}

function EnabledDialog({ backupCodes }: { backupCodes: string[] }) {
    const [isCopyButtonChecked, setIsCopyButtonChecked] = useState(false)
    const [hasConfirmedBackup, setHasConfirmedBackup] = useState(false)

    return (
        <div className="flex flex-col gap-2 p-2 items-center rounded-xl bg-gray-700/30 light:bg-gray-300/30">
            <h3>Backup codes</h3>
            <p>Store these somewhere safe — each can be used once:</p>
            <ul className="relative flex flex-col w-sm px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300">
                <button
                    className="absolute right-0 mr-2 p-1 rounded cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                    onClick={_ => {
                        navigator.clipboard.writeText(backupCodes.join("\n"))
                        setIsCopyButtonChecked(true)
                        setTimeout(() => setIsCopyButtonChecked(false), 2000)
                    }}
                >
                    {isCopyButtonChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                </button>
                {backupCodes.map(c =>
                    <li key={c} className="font-mono">{c}</li>
                )}
            </ul>
            <button className="flex gap-3 cursor-pointer outline-none" onClick={_ => setHasConfirmedBackup(!hasConfirmedBackup)}>
                <div className="flex items-center justify-center size-6 rounded bg-gray-600 hover:bg-gray-500 light:bg-gray-400">
                    {hasConfirmedBackup && <CheckIcon className="size-6" />}
                </div>
                <p>I have backed up the codes.</p>
            </button>
            <Dialog.Close
                className={buttonClassNames + " disabled:opacity-50 disabled:cursor-not-allowed"}
                disabled={!hasConfirmedBackup}
            >
                Close
            </Dialog.Close>
        </div>
    )
}

function DisableDialog({ setStep }: { setStep: Dispatch<SetStateAction<Step>> }) {
    const [code, setCode] = useState("")
    const [error, setError] = useState("")

    async function handleDisable(e: React.FormEvent) {
        e.preventDefault()
        const response = await disableMFA(code)
        if (response.ok) {
            setStep("disabled")
        } else {
            setError("Invalid code")
        }
    }

    return (
        <div className="flex flex-col gap-2 items-center">
            <p>Are you sure you want to disable multi-factor authentication?</p>
            <p>Enter below the 6-digit code from your authenticator to confirm.</p>
            <form className="flex flex-col gap-2 items-center" onSubmit={handleDisable}>
                <input className={inputClassNames} value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code" required />
                <button className={buttonClassNames}>Disable</button>
            </form>
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}

function DisabledDialog() {
    return (
        <div className="flex flex-col gap-1 items-center">
            <p>Multi-factor authentication disabled successfully</p>
            <Dialog.Close className={buttonClassNames}>Close</Dialog.Close>
        </div>
    )
}