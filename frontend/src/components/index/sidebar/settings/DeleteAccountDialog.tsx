import { Cross1Icon } from "@radix-ui/react-icons"
import { Dialog, Label, Tabs } from "radix-ui"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "../../../../providers/AuthProvider"
import { useNotify } from "../../../../providers/NotificationProvider"
import { deleteAccount } from "../../../../utils/api"

export default function DeleteAccountDialog({ entryClasses, destructiveEntryClasses }: { entryClasses: string, destructiveEntryClasses: string }) {
    type MFAMethod = "authenticator" | "recovery"

    const { t } = useTranslation()

    const { user } = useAuth()
    const notify = useNotify()

    const [password, setPassword] = useState("")
    const [mfaMethod, setMFAMethod] = useState<MFAMethod>("authenticator")
    const [mfaCode, setMFACode] = useState("")
    const [error, setError] = useState("")
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleConfirmDelete(e: React.FormEvent) {
        e.preventDefault()

        setIsDeleting(true)
        setError("")

        const response = await deleteAccount(password, mfaCode)
        if (response.ok) {
            location.href = "/login"
        } else if (response.status === 429) {
            setIsDeleting(false)
            notify(t("throttled"), "error")
        } else {
            const data = await response.json()
            setError(t(data.detail))
            setIsDeleting(false)
        }
    }

    if (!user) return

    return (
        <Dialog.Root>
            <Dialog.Trigger className={destructiveEntryClasses} data-testid="open-delete-account">
                {t("dialogs.deleteAccount.button")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        z-10 fixed flex flex-col gap-1 max-w-110 p-3 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <div className="flex gap-1 mt-3 px-3 items-start justify-between">
                        <div className="flex flex-col gap-2">
                            <Dialog.Title className="text-xl font-semibold">{t("dialogs.deleteAccount.title")}</Dialog.Title>
                            <Dialog.Description className="flex flex-col gap-1">
                                <span className="text-lg">{t("dialogs.deleteAccount.descriptionAlert")}</span>
                                {!user.is_guest &&
                                    <span>
                                        {user.mfa.is_enabled ?
                                            t("dialogs.deleteAccount.descriptionInformationWithMFA") :
                                            t("dialogs.deleteAccount.descriptionInformation")
                                        }
                                    </span>
                                }
                            </Dialog.Description>
                        </div>
                        <Dialog.Close className="p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon />
                        </Dialog.Close>
                    </div>

                    <form className="flex flex-col gap-3 px-3 py-1" onSubmit={handleConfirmDelete}>
                        {!user.is_guest && (
                            <div className="flex flex-col gap-1">
                                <Label.Root htmlFor="password" className="font-medium text-gray-200 light:text-gray-700">
                                    {t("auth.password.label")}
                                </Label.Root>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={e => {
                                        setPassword(e.target.value)
                                        setError("")
                                    }}
                                    placeholder="••••••••"
                                    className="px-2 py-1 rounded border bg-gray-900 light:bg-white light:text-black"
                                    disabled={isDeleting}
                                    required
                                />
                            </div>
                        )}

                        {!user.is_guest && user.mfa.is_enabled &&
                            <Tabs.Root
                                className="flex flex-col gap-2 items-center"
                                value={mfaMethod}
                                onValueChange={v => {
                                    setMFAMethod(v as MFAMethod)
                                    setMFACode("")
                                    setError("")
                                }}
                            >
                                <Tabs.List className="flex w-full gap-2">
                                    <Tabs.Trigger
                                        className={`
                                            w-[90%] px-3 py-1 cursor-pointer font-medium
                                            ${mfaMethod === "authenticator" ? "border-b" : "hover:border-b hover:border-gray-500"}
                                        `}
                                        value="authenticator"
                                    >
                                        {t("dialogs.deleteAccount.authenticatorTab")}
                                    </Tabs.Trigger>
                                    <Tabs.Trigger
                                        className={`
                                            w-[90%] px-3 py-1 cursor-pointer font-medium
                                            ${mfaMethod === "recovery" ? "border-b" : "hover:border-b hover:border-gray-500"}
                                        `}
                                        value="recovery"
                                    >
                                        {t("dialogs.deleteAccount.recoveryTab")}
                                    </Tabs.Trigger>
                                </Tabs.List>

                                <Tabs.Content value="authenticator" asChild>
                                    <input
                                        type="text"
                                        value={mfaCode}
                                        onChange={e => {
                                            setMFACode(e.target.value)
                                            setError("")
                                        }}
                                        placeholder={t("auth.mfa.placeholder")}
                                        maxLength={6}
                                        className="w-[80%] mt-2 px-2 py-1 rounded border text-sm bg-gray-900 light:bg-white light:text-black"
                                        disabled={isDeleting}
                                        required
                                    />
                                </Tabs.Content>

                                <Tabs.Content value="recovery" asChild>
                                    <input
                                        type="text"
                                        value={mfaCode}
                                        onChange={e => {
                                            setMFACode(e.target.value)
                                            setError("")
                                        }}
                                        placeholder={t("auth.mfaRecovery.placeholder")}
                                        maxLength={12}
                                        className="w-[80%] mt-2 px-2 py-1 rounded border text-sm bg-gray-900 light:bg-white light:text-black"
                                        disabled={isDeleting}
                                        required
                                    />
                                </Tabs.Content>
                            </Tabs.Root>
                        }

                        {error && <div className="text-red-400 light:text-red-600">{error}</div>}

                        <div className="flex justify-end gap-2 mt-2">
                            <Dialog.Close asChild>
                                <button className={entryClasses} disabled={isDeleting}>{t("dialogs.deleteAccount.cancel")}</button>
                            </Dialog.Close>
                            <button type="submit" className={destructiveEntryClasses} disabled={isDeleting}>
                                {isDeleting ? t("dialogs.deleteAccount.confirming") : t("dialogs.deleteAccount.confirm")}
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}