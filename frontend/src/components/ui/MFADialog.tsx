import { CheckIcon, CopyIcon, Cross1Icon, DownloadIcon } from "@radix-ui/react-icons"
import { QRCodeCanvas } from "qrcode.react"
import { Dialog } from "radix-ui"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

import { buttonClassNames, inputClassNames } from "../Auth"
import { useAuth } from "../../context/AuthProvider"
import { disableMFA, enableMFA, setupMFA } from "../../utils/api"

export default function MFADialog({ triggerClassName }: { triggerClassName: string }) {
    const { user, setUser } = useAuth()
    if (!user) return <></>

    const [step, setStep] = useState<Step>(user.mfa.is_enabled ? "disable" : "setup")
    const [mFAAuthURL, setMFAAuthURL] = useState("")
    const [secret, setSecret] = useState("")
    const [backupCodes, setBackupCodes] = useState<string[]>([])

    useEffect(() => {
        setUser(previous =>
            previous && (step === "enabled" || step === "disabled") ?
                ({ ...previous, mfa: { is_enabled: step === "enabled" } })
                : previous
        )
    }, [step])

    return (
        <Dialog.Root onOpenChange={_ => setStep(user.mfa.is_enabled ? "disable" : "setup")}>
            <Dialog.Trigger className={triggerClassName}>
                {user.mfa.is_enabled ? "Disable" : "Enable"}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed flex flex-col gap-3 p-4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <Dialog.Title className="text-xl font-bold">
                                Manage multi-factor authentication
                            </Dialog.Title>
                            {step !== "enabled" &&
                                <Dialog.Close className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                                    <Cross1Icon />
                                </Dialog.Close>
                            }
                        </div>
                        <Dialog.Description className="text-lg font-semibold">
                            {(() => {
                                switch (step) {
                                    case "setup":
                                        return "Step 1: Setup"
                                    case "enable":
                                        return "Step 2: Verify"
                                    case "enabled":
                                        return "Step 3: Backup"
                                    case "disable":
                                        return "Step 1: Disable"
                                    case "disabled":
                                        return "Step 2: Disabled"
                                }
                            })()}
                        </Dialog.Description>
                    </div>

                    {(() => {
                        switch (step) {
                            case "setup":
                                return <SetupDialog setMFAAuthURL={setMFAAuthURL} setSecret={setSecret} setStep={setStep} />
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

type Step = "setup" | "enable" | "enabled" | "disable" | "disabled"

function SetupDialog({ setMFAAuthURL, setSecret, setStep }: {
    setMFAAuthURL: Dispatch<SetStateAction<string>>
    setSecret: Dispatch<SetStateAction<string>>
    setStep: Dispatch<SetStateAction<Step>>
}) {
    const [error, setError] = useState("")
    const [isSettingUp, setIsSettingUp] = useState(false)

    async function handleSetup() {
        setIsSettingUp(true)
        const response = await setupMFA()
        if (response.ok) {
            const data = await response.json()
            setMFAAuthURL(data.mfa_auth_url)
            setSecret(data.secret)
            setStep("enable")
        } else {
            setIsSettingUp(false)
            setError("There was an error generating QR and secret codes")
        }
    }

    return (
        <div className="flex flex-col gap-1 items-center">
            <button className={buttonClassNames} onClick={handleSetup} disabled={isSettingUp}>
                {isSettingUp ? "Generating" : "Generate"} QR and secret codes
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
    const [isEnabling, setIsEnabling] = useState(false)

    async function handleEnable(e: React.FormEvent) {
        e.preventDefault()

        setIsEnabling(true)
        setError("")

        const response = await enableMFA(code)
        if (response.ok) {
            const data = await response.json()
            setBackupCodes(data.backup_codes)
            setStep("enabled")
        } else {
            setIsEnabling(false)
            setError("Invalid code")
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
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
                <input
                    className={inputClassNames}
                    value={code}
                    onChange={handleInputChange}
                    placeholder="6-digit code"
                    required
                />
                <button className={buttonClassNames} disabled={isEnabling}>
                    {isEnabling ? "Enabling" : "Enable"}
                </button>
            </form>
            {error && <p className="text-red-600">{error}</p>}
        </div>
    )
}

function EnabledDialog({ backupCodes }: { backupCodes: string[] }) {
    const [isCopyButtonChecked, setIsCopyButtonChecked] = useState(false)
    const [hasConfirmedBackup, setHasConfirmedBackup] = useState(false)

    function handleDownload() {
        const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" })
        const url = URL.createObjectURL(blob)

        const a = document.createElement("a")
        a.href = url
        a.download = "Recovery Codes.txt"
        a.click()

        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-col gap-2 p-2 items-center rounded-xl bg-gray-700/30 light:bg-gray-300/30">
            <p>Make sure to backup the following 10 recovery codes (each one can only be used once):</p>
            <ul className="relative flex flex-col w-sm px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300">
                <div className="absolute right-0 flex flex-col mr-2 gap-1">
                    <button
                        className="p-1.5 rounded items-center justify-center cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                        onClick={_ => {
                            navigator.clipboard.writeText(backupCodes.join("\n"))
                            setIsCopyButtonChecked(true)
                            setTimeout(() => setIsCopyButtonChecked(false), 2000)
                        }}
                    >
                        {isCopyButtonChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                    </button>
                    <button
                        className="p-1.5 rounded items-center justify-center cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                        onClick={handleDownload}
                    >
                        <DownloadIcon className="size-4.5" />
                    </button>
                </div>
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
            <Dialog.Close className={buttonClassNames} disabled={!hasConfirmedBackup}>
                Close
            </Dialog.Close>
        </div>
    )
}

function DisableDialog({ setStep }: { setStep: Dispatch<SetStateAction<Step>> }) {
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [isDisabling, setIsDisabling] = useState(false)

    async function handleDisable(e: React.FormEvent) {
        e.preventDefault()

        setIsDisabling(true)
        setError("")

        const response = await disableMFA(code)
        if (response.ok) {
            setStep("disabled")
        } else {
            setIsDisabling(false)
            setError("Invalid code")
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-2">
            <p>Are you sure you want to disable multi-factor authentication?</p>
            <p>Enter below the 6-digit code from your authenticator to confirm.</p>
            <form className="flex flex-col gap-2 w-fit items-center self-center" onSubmit={handleDisable}>
                <input className={inputClassNames} value={code} onChange={handleInputChange} placeholder="6-digit code" required />
                <button className={buttonClassNames} disabled={isDisabling}>
                    {isDisabling ? "Disabling" : "Disable"}
                </button>
            </form>
            {error && <p className="text-red-600 self-center">{error}</p>}
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