import { CheckIcon, CopyIcon, Cross1Icon, DownloadIcon } from "@radix-ui/react-icons"
import { QRCodeCanvas } from "qrcode.react"
import { Dialog, Label } from "radix-ui"
import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "../../../../providers/AuthProvider"
import { useNotify } from "../../../../providers/NotificationProvider"
import { disableMFA, enableMFA, setupMFA } from "../../../../utils/api"
import { useChat } from "../../../../providers/ChatProvider"

export default function MFADialog({ triggerClassName }: { triggerClassName: string }) {
    const { user, setUser } = useAuth()
    const { isMobile } = useChat()
    const { t } = useTranslation()

    if (!user) return

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
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className={`
                        z-10 fixed flex flex-col gap-5 p-6 top-1/2 -translate-y-1/2
                        rounded-xl text-white light:text-black bg-zinc-800 light:bg-zinc-100
                        ${isMobile ? "inset-0 mx-2 h-fit" : "right-1/2 translate-x-1/2"}
                    `}
                    onEscapeKeyDown={e => isLocked && e.preventDefault()}
                    onInteractOutside={e => isLocked && e.preventDefault()}
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2 items-center justify-between">
                            <Dialog.Title className="text-xl font-bold">
                                {t("mfa.title")}
                            </Dialog.Title>
                            {!isLocked &&
                                <Dialog.Close className="p-1.5 rounded-3xl cursor-pointer hover:bg-zinc-700 light:hover:bg-zinc-300">
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
    const { t } = useTranslation()

    const notify = useNotify()

    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isSettingUp, setIsSettingUp] = useState(false)

    async function handleSetup(e: React.FormEvent) {
        e.preventDefault()

        setIsLocked(true)
        setIsSettingUp(true)
        setError("")

        const response = await setupMFA(password)
        if (response.ok) {
            const data = await response.json()
            setAuthURL(data.auth_url)
            setSecret(data.secret)
            setStep("enable")
        } else if (response.status === 429) {
            setIsSettingUp(false)
            notify(t("throttled"), "error")
        } else {
            setIsSettingUp(false)
            setError(t((await response.json()).detail))
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setPassword(e.target.value)
    }

    return (
        <form className="flex flex-col gap-3 items-center" onSubmit={handleSetup}>
            <p className={paragraphClassName}>{t("mfa.messages.setup")}</p>
            <div className="flex flex-col w-full gap-1">
                <Label.Root htmlFor="password" className="font-medium text-zinc-200 light:text-zinc-700">
                    {t("auth.password.label")}
                </Label.Root>
                <input
                    id="password"
                    type="password"
                    className={inputClassNames}
                    placeholder={t("auth.password.placeholder")}
                    value={password}
                    onChange={handleInputChange}
                    required
                />
            </div>
            <button className={buttonClassNames} disabled={isSettingUp || !password}>
                {isSettingUp ? t("mfa.buttons.generating") : t("mfa.buttons.generate")}
            </button>
            {error && <p className={errorParagraphClassName}>{error}</p>}
        </form>
    )
}

function EnableDialog({ authURL, secret, setBackupCodes, setStep, setIsLocked }: {
    authURL: string
    secret: string
    setBackupCodes: Dispatch<SetStateAction<string[]>>
    setStep: Dispatch<SetStateAction<Step>>
    setIsLocked: Dispatch<SetStateAction<boolean>>
}) {
    const { isMobile } = useChat()
    const { t } = useTranslation()
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
        } else if (response.status === 429) {
            setIsEnabling(false)
            notify(t("throttled"), "error")
        } else {
            const data = await response.json()
            setIsEnabling(false)
            setError(t(data.detail))
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-3 items-center">
            <p className={paragraphClassName}>{t("mfa.messages.setupQrInfo")}</p>
            <div className="my-2">
                <QRCodeCanvas value={authURL} size={200} />
            </div>
            <div className={`flex gap-1 px-2 py-1 rounded-xl bg-zinc-700 light:bg-zinc-300 ${isMobile ? "flex-col" : "items-center"}`}>
                <p className="px-2 font-semibold">{t("mfa.labels.secret")}</p>
                <p className={`px-3 py-1 wrap-anywhere ${isMobile && "text-sm"} rounded-lg bg-zinc-800/30`} data-testid="mfa-secret">{secret}</p>
                <button
                    className="flex gap-2 md:ml-2 px-2 py-0.5 items-center rounded cursor-pointer hover:bg-zinc-600/50 light:hover:bg-zinc-400/50"
                    onClick={_ => {
                        navigator.clipboard.writeText(secret)
                        setIsCopyButtonChecked(true)
                        setTimeout(() => setIsCopyButtonChecked(false), 2000)
                    }}
                >
                    {isCopyButtonChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                    {isCopyButtonChecked ? t("copyButton.tooltip.clicked") : t("copyButton.tooltip")}
                </button>
            </div>
            <form className="flex flex-col gap-3 items-center" onSubmit={handleEnable}>
                <input
                    className={inputClassNames}
                    value={code}
                    onChange={handleInputChange}
                    placeholder={t("mfa.placeholders.sixDigitCode")}
                    maxLength={6}
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
    const { isMobile } = useChat()
    const { t } = useTranslation()

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
        <div className="flex flex-col gap-3 items-center">
            <p className={paragraphClassName}>{t("mfa.messages.backupInfo")}</p>

            <div className="flex flex-col gap-2 px-3 py-2 items-center rounded-lg bg-zinc-700/50 light:bg-zinc-300/50">
                <ul className="px-3 py-1 rounded-lg bg-zinc-700/80 light:bg-zinc-300/80">
                    {backupCodes.map(c =>
                        <li key={c} className="font-mono">{c}</li>
                    )}
                </ul>

                <div className="flex flex-col size-full gap-3">
                    <button
                        className={`
                            flex gap-2 px-2 py-1 items-center cursor-pointer rounded-lg bg-zinc-700/80 light:bg-zinc-300/80
                            ${!isMobile && "rounded-lg hover:bg-zinc-600/50 light:hover:bg-zinc-400/50"}
                        `}
                        onClick={_ => {
                            navigator.clipboard.writeText(backupCodes.join("\n"))
                            setIsCopyButtonChecked(true)
                            setTimeout(() => setIsCopyButtonChecked(false), 2000)
                        }}
                    >
                        {isCopyButtonChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                        {t(isCopyButtonChecked ? "copyButton.tooltip.clicked" : "copyButton.tooltip")}
                    </button>

                    <button
                        className={`
                            flex gap-2 px-2 py-1 items-center cursor-pointer rounded-lg bg-zinc-700/80 light:bg-zinc-300/80
                            ${!isMobile && "rounded-lg hover:bg-zinc-600/50 light:hover:bg-zinc-400/50"}
                        `}
                        onClick={handleDownload}
                    >
                        <DownloadIcon className="size-4.5" />
                        {t("mfa.buttons.download")}
                    </button>
                </div>
            </div>

            <button
                className="flex gap-2 min-h-10 px-4 py-1 items-center rounded-xl cursor-pointer bg-zinc-700/40 light:bg-zinc-300"
                onClick={_ => setHasConfirmedBackup(!hasConfirmedBackup)}
            >
                <div className="flex min-w-6.5 max-w-6.5 min-h-6.5 max-h-6.5 items-center rounded-lg bg-zinc-700 light:bg-zinc-100">
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
    const { t } = useTranslation()
    const notify = useNotify()

    const [method, setMethod] = useState<"authenticator" | "recovery">("authenticator")
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [isDisabling, setIsDisabling] = useState(false)

    const methodSwitchClassName = `
        w-full text-center text-zinc-400 light:text-zinc-600 cursor-pointer
        disabled:cursor-not-allowed enabled:hover:underline disabled:text-zinc-600 light:disabled:text-zinc-400
    `

    async function handleDisable(e: React.FormEvent) {
        e.preventDefault()

        setIsLocked(true)
        setIsDisabling(true)
        setError("")

        const response = await disableMFA(code)
        if (response.ok) {
            setStep("disabled")
            notify(t("mfa.messages.disabledMessage"), "success")
        } else if (response.status === 429) {
            setIsDisabling(false)
            notify(t("throttled"), "error")
        } else {
            const data = await response.json()
            setIsDisabling(false)
            setError(t(data.detail))
        }

        setIsLocked(false)
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError("")
        setCode(e.target.value)
    }

    return (
        <div className="flex flex-col gap-3 items-center">
            <p className={paragraphClassName}>{t("mfa.messages.disableConfirm")}</p>
            <p className={paragraphClassName}>
                {t(method === "authenticator" ? "mfa.messages.authenticatorDisableInstruction" : "mfa.messages.recoveryDisableInstruction")}
            </p>
            <form className="flex flex-col w-full gap-3 items-center" onSubmit={handleDisable}>
                <input
                    className={inputClassNames + " w-full md:w-[70%]"}
                    value={code}
                    placeholder={t(method === "authenticator" ? "auth.mfa.placeholder" : "auth.mfaRecovery.placeholder")}
                    maxLength={method === "authenticator" ? 6 : 12}
                    onChange={handleInputChange}
                    required
                />
                <button className={buttonClassNames} disabled={isDisabling}>
                    {isDisabling ? t("mfa.buttons.disabling") : t("mfa.buttons.disable")}
                </button>
            </form>
            {error && <p className={errorParagraphClassName + " self-center"}>{error}</p>}
            <button
                className={methodSwitchClassName}
                onClick={_ => {
                    setMethod(method === "authenticator" ? "recovery" : "authenticator")
                    setCode("")
                    setError("")
                }}
                disabled={isDisabling}
            >
                {method === "authenticator" ? t("login.mfa.useRecovery") : t("login.mfaRecovery.useAuthenticator")}
            </button>
        </div>
    )
}

function DisabledDialog() {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-3 items-center">
            <p className={paragraphClassName}>{t("mfa.messages.disabledSuccess")}</p>
            <Dialog.Close className={buttonClassNames}>{t("mfa.buttons.close")}</Dialog.Close>
        </div>
    )
}

const paragraphBaseClassName = "w-fit px-2 py-1 text-center rounded-lg"
const paragraphClassName = paragraphBaseClassName + " bg-zinc-700 light:bg-zinc-300"
const errorParagraphClassName = paragraphBaseClassName + " text-white bg-red-500/60 light:bg-red-500"
const inputClassNames = "px-3 py-2 rounded-xl outline-none bg-zinc-700 light:bg-zinc-300"
const buttonClassNames = `
    px-6 py-1 rounded-xl cursor-pointer
    bg-zinc-700 light:bg-zinc-300
    hover:bg-zinc-600 light:hover:bg-zinc-400
    disabled:opacity-50 disabled:cursor-not-allowed
`