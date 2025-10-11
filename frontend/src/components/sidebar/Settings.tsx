import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, Cross1Icon, GearIcon } from "@radix-ui/react-icons"
import { QRCodeCanvas } from "qrcode.react"
import { Dialog, Select } from "radix-ui"
import React, { useEffect, useState, type ReactNode } from "react"

import ConfirmDialog from "../ui/ConfirmDialog"
import { buttonClassNames, inputClassNames } from "../Auth"
import { useAuth } from "../../context/AuthProvider"
import { deleteAccount, deleteChats, disableMFA, enableMFA, logout, me, setupMFA } from "../../utils/api"
import { applyTheme } from "../../utils/theme"
import type { Theme } from "../../types"

export default function Settings({ isSidebarOpen, itemClassNames }: { isSidebarOpen: boolean, itemClassNames: string }) {
    const { user } = useAuth()

    return (
        <Dialog.Root>
            <Dialog.Trigger className={itemClassNames} data-testid="open-settings">
                <GearIcon className="size-5" /> {isSidebarOpen && "Settings"}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed flex flex-col gap-5 w-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        p-6 rounded-xl bg-gray-800 light:bg-gray-300 text-white light:text-black
                    "
                >
                    <div className="flex justify-between items-center">
                        <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-200" data-testid="close-settings">
                            <Cross1Icon className="size-5" />
                        </Dialog.Close>
                    </div>

                    {user && <div className="font-semibold">Email: {user.email}</div>}

                    <div className="flex flex-col border-t-2">
                        <Entry name="Theme" item={<ThemeEntryItem />} />
                        <Entry name="Multi-factor authentication" item={<MFAEntryItem />} />
                        <Entry name="Delete chats" item={<DeleteChatsEntryItem />} />
                        <Entry name="Delete account" item={<DeleteAccountEntryItem />} />
                        <Entry name="Log out" item={<LogoutEntryItem />} />
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function ThemeEntryItem() {
    const { user } = useAuth()
    const [theme, setTheme] = useState(user?.theme || "System")

    function isTheme(value: unknown): value is Theme {
        return value === "System" || value === "Light" || value === "Dark"
    }

    function handleChangeTheme(themeValue: string) {
        const themeToSelect = isTheme(themeValue) ? themeValue : "System"
        me(themeToSelect)
        setTheme(themeToSelect)
        applyTheme(themeToSelect)
    }

    return (
        <Select.Root value={theme} onValueChange={handleChangeTheme}>
            <Select.Trigger className={entryClasses + " inline-flex items-center justify-between w-30"} aria-label="Theme">
                <Select.Value placeholder="Select theme…" />
                <Select.Icon>
                    <ChevronDownIcon />
                </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
                <Select.Content className="text-white overflow-hidden rounded-md shadow-lg bg-gray-600 light:text-black light:bg-gray-200">
                    <Select.ScrollUpButton>
                        <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                        <Select.Item value="System" className={itemClasses}>
                            <Select.ItemText>System</Select.ItemText>
                            <Select.ItemIndicator className="ml-auto">
                                <CheckIcon />
                            </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item value="Light" className={itemClasses}>
                            <Select.ItemText>Light</Select.ItemText>
                            <Select.ItemIndicator className="ml-auto">
                                <CheckIcon />
                            </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item value="Dark" className={itemClasses}>
                            <Select.ItemText>Dark</Select.ItemText>
                            <Select.ItemIndicator className="ml-auto">
                                <CheckIcon />
                            </Select.ItemIndicator>
                        </Select.Item>
                    </Select.Viewport>
                    <Select.ScrollDownButton>
                        <ChevronDownIcon />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

type MFAStep = "generate" | "enable" | "enabled" | "disable" | "disabled"

function GenerateDialog({ setMFAAuthURL, setSecret, setStep }: {
    setMFAAuthURL: React.Dispatch<React.SetStateAction<string | null>>
    setSecret: React.Dispatch<React.SetStateAction<string | null>>
    setStep: React.Dispatch<React.SetStateAction<MFAStep>>
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
    setBackupCodes: React.Dispatch<React.SetStateAction<string[] | null>>
    setStep: React.Dispatch<React.SetStateAction<MFAStep>>
}) {
    const [code, setCode] = useState("")
    const [error, setError] = useState("")

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
            <p>Secret: {secret}</p>
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
            <Dialog.Close className={buttonClassNames}>Done</Dialog.Close>
        </div>
    )
}

function DisableDialog({ setStep }: { setStep: React.Dispatch<React.SetStateAction<MFAStep>> }) {
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

function ActionDialog({ step, setStep, mFAAuthURL, setMFAAuthURL, secret, setSecret, backupCodes, setBackupCodes }: {
    step: MFAStep
    setStep: React.Dispatch<React.SetStateAction<MFAStep>>
    mFAAuthURL: string | null
    setMFAAuthURL: React.Dispatch<React.SetStateAction<string | null>>
    secret: string | null
    setSecret: React.Dispatch<React.SetStateAction<string | null>>
    backupCodes: string[] | null
    setBackupCodes: React.Dispatch<React.SetStateAction<string[] | null>>
}) {
    switch (step) {
        case "generate":
            return <GenerateDialog setMFAAuthURL={setMFAAuthURL} setSecret={setSecret} setStep={setStep} />
        case "enable":
            return mFAAuthURL && secret && <EnableDialog mFAAuthURL={mFAAuthURL} secret={secret} setBackupCodes={setBackupCodes} setStep={setStep} />
        case "enabled":
            return backupCodes && <EnabledDialog backupCodes={backupCodes} />
        case "disable":
            return <DisableDialog setStep={setStep} />
        case "disabled":
            return <DisabledDialog />
    }
}

function MFAEntryItem() {
    const { user, setUser } = useAuth()
    if (!user) return <></>

    const [step, setStep] = useState<MFAStep>(user.has_mfa_enabled ? "disable" : "generate")
    const [mFAAuthURL, setMFAAuthURL] = useState<string | null>(null)
    const [secret, setSecret] = useState<string | null>(null)
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

    useEffect(() => {
        setUser(previous =>
            previous && (step === "enabled" || step === "disabled") ?
                ({ ...previous, has_mfa_enabled: step === "enabled" })
                : previous
        )
    }, [step])

    return (
        <Dialog.Root onOpenChange={_ => setStep(user.has_mfa_enabled ? "disable" : "generate")}>
            <Dialog.Trigger className={entryClasses}>
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
                    <div className="relative">
                        <Dialog.Title className="text-xl font-bold">
                            Manage multi-factor authentication
                        </Dialog.Title>

                        <Dialog.Description className="text-lg">
                            {user.has_mfa_enabled ? (
                                "Disable multi-factor authentication."
                            ) : (
                                "Enable multi-factor authentication for improved account security."
                            )}
                        </Dialog.Description>

                        <Dialog.Close className="absolute right-0 top-0 p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon className="size-4" />
                        </Dialog.Close>
                    </div>

                    <ActionDialog
                        step={step}
                        setStep={setStep}
                        mFAAuthURL={mFAAuthURL}
                        setMFAAuthURL={setMFAAuthURL}
                        secret={secret}
                        setSecret={setSecret}
                        backupCodes={backupCodes}
                        setBackupCodes={setBackupCodes}
                    />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function DeleteChatsEntryItem() {
    function handleDeleteChats() {
        deleteChats().then(response => {
            if (response.ok) {
                if (location.pathname.includes("chat")) {
                    location.href = "/"
                } else {
                    const historyEntries = document.querySelector(".history-entries")
                    if (historyEntries) {
                        historyEntries.innerHTML = ""
                    }
                }
            } else {
                alert("Deletion of chats was not possible")
            }
        })
    }

    return (
        <ConfirmDialog
            trigger={
                <button className={destructiveEntryClasses}>
                    Delete all
                </button>
            }
            title="Delete Chats"
            description="Are you sure you want to delete all of your chats? This action cannot be undone."
            confirmText="Delete all"
            cancelText="Cancel"
            onConfirm={handleDeleteChats}
        />
    )
}

function DeleteAccountEntryItem() {
    function handleDeleteAccount() {
        deleteAccount().then(response => {
            if (response.ok) {
                location.reload()
            } else {
                alert("Deletion of account was not possible")
            }
        })
    }

    return (
        <ConfirmDialog
            trigger={
                <button className={destructiveEntryClasses}>
                    Delete
                </button>
            }
            title="Delete Account"
            description="Are you sure you want to delete your account? This action cannot be undone."
            confirmText="Delete Account"
            cancelText="Cancel"
            onConfirm={handleDeleteAccount}
        />
    )
}

function LogoutEntryItem() {
    async function handleLogout() {
        await logout()
        location.reload()
    }

    return (
        <button className={entryClasses} onClick={handleLogout}>
            Log out
        </button>
    )
}

function Entry({ name, item }: { name: string, item: ReactNode }) {
    return (
        <div className="flex justify-between items-center border-b py-2">
            <label>{name}</label>
            {item}
        </div>
    )
}

const entryClasses = "px-2 py-1 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-600 light:border-gray-800 light:hover:bg-gray-400"
const destructiveEntryClasses = entryClasses + " text-red-500"
const itemClasses = "flex items-center px-2 py-1 rounded cursor-pointer hover:bg-gray-500 light:hover:bg-gray-300"