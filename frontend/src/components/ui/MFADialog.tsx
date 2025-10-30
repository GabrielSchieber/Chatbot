import { CheckIcon, CopyIcon, Cross1Icon, DownloadIcon } from "@radix-ui/react-icons"
import { QRCodeCanvas } from "qrcode.react"
import { Dialog } from "radix-ui"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

import { useAuth } from "../../context/AuthProvider"
import { useNotify } from "../../context/NotificationProvider"
import { disableMFA, enableMFA, setupMFA } from "../../utils/api"

export default function MFADialog({ triggerClassName }: { triggerClassName: string }) {
    const { user, setUser } = useAuth()
    if (!user) return <></>

    const [step, setStep] = useState<Step>(user.mfa.is_enabled ? "disable" : "setup")
    const [authURL, setAuthURL] = useState("")
    const [secret, setSecret] = useState("")
    const [backupCodes, setBackupCodes] = useState<string[]>([])
    const [isLocked, setIsLocked] = useState(false)

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
                        fixed flex flex-col gap-5 p-6 top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                    onEscapeKeyDown={e => isLocked && e.preventDefault()}
                    onInteractOutside={e => isLocked && e.preventDefault()}
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 items-center justify-between">
                            <Dialog.Title className="text-xl font-bold">
                                Manage multi-factor authentication
                            </Dialog.Title>
                            {!isLocked &&
                                <Dialog.Close className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                                    <Cross1Icon />
                                </Dialog.Close>
                            }
                        </div>
                        <Dialog.Description className="text-center text-lg font-semibold">
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
                                return <SetupDialog setAuthURL={setAuthURL} setSecret={setSecret} setStep={setStep} setIsLocked={setIsLocked} />
                            case "enable":
                                return <EnableDialog authURL={authURL} secret={secret} setBackupCodes={setBackupCodes} setStep={setStep} setIsLocked={setIsLocked} />
                            case "enabled":
                                return <EnabledDialog backupCodes={backupCodes} setIsLocked={setIsLocked} />
                            case "disable":
                                return <DisableDialog setStep={setStep} setIsLocked={setIsLocked} />
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

function SetupDialog({ setAuthURL, setSecret, setStep, setIsLocked }: {
    setAuthURL: Dispatch<SetStateAction<string>>
    setSecret: Dispatch<SetStateAction<string>>
    setStep: Dispatch<SetStateAction<Step>>
    setIsLocked: Dispatch<SetStateAction<boolean>>
}) {
    const [error, setError] = useState("")
    const [isSettingUp, setIsSettingUp] = useState(false)

    async function handleSetup() {
        setIsLocked(true)
        setIsSettingUp(true)

        const response = await setupMFA()
        if (response.ok) {
            const data = await response.json()
            setAuthURL(data.auth_url)
            setSecret(data.secret)
            setStep("enable")
        } else {
            setIsSettingUp(false)
            setError("There was an error generating QR and secret codes")
        }

        setIsLocked(false)
    }

    return (
        <div className="flex flex-col gap-1 items-center">
            <button className={buttonClassNames} onClick={handleSetup} disabled={isSettingUp}>
                {isSettingUp ? "Generating" : "Generate"} QR and secret codes
            </button>
            {error && <p className={errorParagraphClassName}>{error}</p>}
        </div>
    )
}

function EnableDialog({ authURL, secret, setBackupCodes, setStep, setIsLocked }: {
    authURL: string
    secret: string
    setBackupCodes: Dispatch<SetStateAction<string[]>>
    setStep: Dispatch<SetStateAction<Step>>
    setIsLocked: Dispatch<SetStateAction<boolean>>
}) {
    const notify = useNotify()

    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [isCopyButtonChecked, setIsCopyButtonChecked] = useState(false)
    const [isEnabling, setIsEnabling] = useState(false)

    async function handleEnable(e: React.FormEvent) {
        e.preventDefault()

        setIsLocked(true)
        setIsEnabling(true)
        setError("")

        const response = await enableMFA(code)
        if (response.ok) {
            const data = await response.json()
            setBackupCodes(data.backup_codes)
            setStep("enabled")
            notify("Multi-factor authentication enabled successfully!", "success")
        } else {
            setIsEnabling(false)
            setError("Invalid code")
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-2 items-center">
            <p className={paragraphClassName}>
                Scan this QR in your authenticator app (or use the secret below):
            </p>
            <div className="my-2">
                <QRCodeCanvas value={authURL} size={200} />
            </div>
            <div className="flex gap-2 px-2 py-0.5 items-center rounded bg-gray-700 light:bg-gray-300">
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
            {error && <p className={errorParagraphClassName}>{error}</p>}
        </div>
    )
}

function EnabledDialog({ backupCodes, setIsLocked }: { backupCodes: string[], setIsLocked: Dispatch<SetStateAction<boolean>> }) {
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

    useEffect(() => setIsLocked(!hasConfirmedBackup), [hasConfirmedBackup])

    return (
        <div className="flex flex-col gap-2 p-2 items-center rounded-xl bg-gray-700/30 light:bg-gray-300/30">
            <p className={paragraphClassName}>
                Make sure to backup the following 10 recovery codes in a safe place (each one can only be used once):
            </p>

            <ul className="flex w-[60%] min-w-70 px-4 py-2 justify-between rounded-xl bg-gray-700 light:bg-gray-300">
                <div>
                    {backupCodes.map(c =>
                        <li key={c} className="font-mono">{c}</li>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <button
                        className="p-1.5 rounded cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                        onClick={_ => {
                            navigator.clipboard.writeText(backupCodes.join("\n"))
                            setIsCopyButtonChecked(true)
                            setTimeout(() => setIsCopyButtonChecked(false), 2000)
                        }}
                    >
                        {isCopyButtonChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                    </button>

                    <button
                        className="p-1.5 rounded cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                        onClick={handleDownload}
                    >
                        <DownloadIcon className="size-4.5" />
                    </button>
                </div>
            </ul>

            <button className="flex gap-2 p-1 items-center rounded cursor-pointer" onClick={_ => setHasConfirmedBackup(!hasConfirmedBackup)}>
                <div className="flex size-6 rounded bg-gray-700 light:bg-gray-300">
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

function DisableDialog({ setStep, setIsLocked }: { setStep: Dispatch<SetStateAction<Step>>, setIsLocked: Dispatch<SetStateAction<boolean>> }) {
    const notify = useNotify()

    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [isDisabling, setIsDisabling] = useState(false)

    async function handleDisable(e: React.FormEvent) {
        e.preventDefault()

        setIsLocked(true)
        setIsDisabling(true)
        setError("")

        const response = await disableMFA(code)
        if (response.ok) {
            setStep("disabled")
            notify("Multi-factor authentication disabled successfully!", "success")
        } else {
            setIsDisabling(false)
            setError("Invalid code")
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-2 max-w-[30vw] items-center">
            <p className={paragraphClassName}>
                Are you sure you want to disable multi-factor authentication?
            </p>
            <p className={paragraphClassName}>
                Enter below the 6-digit code from your authenticator or recovery code to confirm.
            </p>
            <form className="flex flex-col gap-2 items-center" onSubmit={handleDisable}>
                <input
                    className={inputClassNames}
                    value={code}
                    onChange={handleInputChange}
                    placeholder="Enter code"
                    required
                />
                <button className={buttonClassNames} disabled={isDisabling}>
                    {isDisabling ? "Disabling" : "Disable"}
                </button>
            </form>
            {error && <p className={errorParagraphClassName}>{error}</p>}
        </div>
    )
}

function DisabledDialog() {
    return (
        <div className="flex flex-col gap-1 items-center">
            <p className={paragraphClassName}>Multi-factor authentication disabled successfully</p>
            <Dialog.Close className={buttonClassNames}>Close</Dialog.Close>
        </div>
    )
}

const paragraphBaseClassName = "w-fit px-2 py-1 text-center rounded-lg"
const paragraphClassName = paragraphBaseClassName + " bg-gray-700 light:bg-gray-300"
const errorParagraphClassName = paragraphBaseClassName + " text-white bg-red-500/60 light:bg-red-500"
const inputClassNames = "w-full px-3 py-2 rounded-xl outline-none bg-gray-700 light:bg-gray-300"
const buttonClassNames = `
    px-6 py-1 rounded-xl cursor-pointer
    bg-gray-700 light:bg-gray-300
    hover:bg-gray-600 light:hover:bg-gray-400
    disabled:opacity-50 disabled:cursor-not-allowed
`