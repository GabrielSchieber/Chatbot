import { CheckIcon, CopyIcon, Cross1Icon, DownloadIcon } from "@radix-ui/react-icons"
import { t } from "i18next"
import { QRCodeCanvas } from "qrcode.react"
import { Dialog } from "radix-ui"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

import { useAuth } from "../providers/AuthProvider"
import { useNotify } from "../providers/NotificationProvider"
import { disableMFA, enableMFA, setupMFA } from "../utils/api"

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
                {user.mfa.is_enabled ? t("mfa.buttons.disable") : t("mfa.buttons.enable")}
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
                                {t("mfa.title")}
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
                                        return t("mfa.steps.setup")
                                    case "enable":
                                        return t("mfa.steps.enable")
                                    case "enabled":
                                        return t("mfa.steps.enabled")
                                    case "disable":
                                        return t("mfa.steps.disable")
                                    case "disabled":
                                        return t("mfa.steps.disabled")
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
            setError(t("mfa.messages.errorGenerate"))
        }

        setIsLocked(false)
    }

    return (
        <div className="flex flex-col gap-1 items-center">
            <button className={buttonClassNames} onClick={handleSetup} disabled={isSettingUp}>
                {isSettingUp ? t("mfa.buttons.generating") : t("mfa.buttons.generate")}
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
            notify(t("mfa.messages.enabledSuccess"), "success")
        } else {
            setIsEnabling(false)
            setError(t("mfa.messages.errorInvalidCode"))
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-2 items-center">
            <p className={paragraphClassName}>{t("mfa.messages.setupQrInfo")}</p>
            <div className="my-2">
                <QRCodeCanvas value={authURL} size={200} />
            </div>
            <div className="flex gap-2 px-2 py-0.5 items-center rounded bg-gray-700 light:bg-gray-300">
                <p>{t("mfa.labels.secret")} {secret}</p>
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
                    placeholder={t("mfa.placeholders.sixDigitCode")}
                    required
                />
                <button className={buttonClassNames} disabled={isEnabling}>
                    {isEnabling ? t("mfa.buttons.enabling") : t("mfa.buttons.enable")}
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
        a.download = t("mfa.labels.recoveryFileName")
        a.click()

        URL.revokeObjectURL(url)
    }

    useEffect(() => setIsLocked(!hasConfirmedBackup), [hasConfirmedBackup])

    return (
        <div className="flex flex-col gap-2 p-2 items-center rounded-xl bg-gray-700/30 light:bg-gray-300/30">
            <p className={paragraphClassName}>{t("mfa.messages.backupInfo")}</p>

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
                <p>{t("mfa.messages.backupConfirm")}</p>
            </button>

            <Dialog.Close className={buttonClassNames} disabled={!hasConfirmedBackup}>
                {t("mfa.buttons.close")}
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
            notify(t("mfa.messages.disabledMessage"), "success")
        } else {
            setIsDisabling(false)
            setError(t("mfa.messages.errorInvalidCode"))
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-2 max-w-[30vw] self-center items-center">
            <p className={paragraphClassName}>{t("mfa.messages.disableConfirm")}</p>
            <p className={paragraphClassName}>{t("mfa.messages.disableInstruction")}</p>
            <form className="flex flex-col gap-2 items-center" onSubmit={handleDisable}>
                <input
                    className={inputClassNames}
                    value={code}
                    onChange={handleInputChange}
                    placeholder={t("mfa.placeholders.enterCode")}
                    required
                />
                <button className={buttonClassNames} disabled={isDisabling}>
                    {isDisabling ? t("mfa.buttons.disabling") : t("mfa.buttons.disable")}
                </button>
            </form>
            {error && <p className={errorParagraphClassName}>{error}</p>}
        </div>
    )
}

function DisabledDialog() {
    return (
        <div className="flex flex-col gap-1 items-center">
            <p className={paragraphClassName}>{t("mfa.messages.disabledSuccess")}</p>
            <Dialog.Close className={buttonClassNames}>{t("mfa.buttons.close")}</Dialog.Close>
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