import { CheckIcon, ChevronDownIcon, Cross1Icon, EnvelopeClosedIcon, GearIcon, LockClosedIcon, MixerHorizontalIcon, PersonIcon } from "@radix-ui/react-icons"
import { Dialog, Select, Tabs } from "radix-ui"
import { useState, useEffect, type ReactNode } from "react"

import { ArchivedChatsDialog } from "../ui/ArchivedChatsDialog"
import ConfirmDialog from "../ui/ConfirmDialog"
import MFADialog from "../ui/MFADialog"
import { useAuth } from "../../context/AuthProvider"
import { useChat } from "../../context/ChatProvider"
import { deleteAccount, deleteChats, logout, me } from "../../utils/api"
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

                <Dialog.Title hidden>Settings</Dialog.Title>
                <Dialog.Description hidden>Settings</Dialog.Description>

                <Dialog.Content>
                    <Tabs.Root
                        className="fixed flex top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 text-white light:text-black"
                        defaultValue="General"
                        orientation="vertical"
                    >
                        <Tabs.List className="flex flex-col gap-1 p-4 items-start rounded-l-xl bg-gray-900 light:bg-gray-100">
                            <Dialog.Close className={"ml-1 p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"} data-testid="close-settings">
                                <Cross1Icon className="size-5" />
                            </Dialog.Close>

                            <Trigger icon={<GearIcon className="size-4.5" />} title="General" />
                            <Trigger icon={<MixerHorizontalIcon className="size-4.5" />} title="Data" />
                            <Trigger icon={<LockClosedIcon className="size-4.5" />} title="Security" />
                            <Trigger icon={<PersonIcon className="size-4.5" />} title="Account" />
                        </Tabs.List>

                        <Content title="General">
                            <Entry name="Theme" item={<ThemeEntryItem />} />
                        </Content>

                        <Content title="Data">
                            <Entry name="Archived chats" item={<ArchivedChatsDialog triggerClassName={entryClasses} />} />
                            <Entry name="Delete chats" item={<DeleteChatsEntryItem />} />
                        </Content>

                        <Content title="Security">
                            <Entry name="Multi-factor authentication" item={<MFADialog triggerClassName={entryClasses} />} />
                            <Entry name="Log out" item={<LogoutEntryItem />} />
                        </Content>

                        <Content title="Account">
                            {user && (
                                <div className="flex gap-2 py-3 items-center">
                                    <EnvelopeClosedIcon className="size-4.5" />
                                    <p>{user.email}</p>
                                </div>
                            )}
                            <Entry name="Delete account" item={<DeleteAccountEntryItem />} />
                        </Content>
                    </Tabs.Root>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function Trigger({ icon, title }: { icon: ReactNode, title: string }) {
    return (
        <Tabs.Trigger
            value={title}
            className={`
                flex w-full gap-1 px-2 py-1 items-center cursor-pointer outline-none rounded-lg
                hover:bg-gray-700 light:hover:bg-gray-300
                focus:bg-gray-700 light:focus:bg-gray-300
            `}
        >
            {icon} {title}
        </Tabs.Trigger>
    )
}

function Content({ title, children }: { title: string, children: ReactNode }) {
    return (
        <Tabs.Content value={title} className="min-w-100 rounded-r-xl bg-gray-800 light:bg-gray-200" tabIndex={-1}>
            <section className="flex flex-col">
                <h2 className="p-4 mb-1 text-xl font-semibold border-b">{title}</h2>
                <div className="flex flex-col px-4 divide-y divide-gray-500">
                    {children}
                </div>
            </section>
        </Tabs.Content>
    )
}

function ThemeEntryItem() {
    const { user, setUser } = useAuth()
    const [theme, setTheme] = useState(user?.preferences.theme || "System")

    function isTheme(value: unknown): value is Theme {
        return value === "System" || value === "Light" || value === "Dark"
    }

    function handleChangeTheme(themeValue: string) {
        const themeToSelect = isTheme(themeValue) ? themeValue : "System"
        me(undefined, themeToSelect)
        setUser(previous => previous ? ({ ...previous, preferences: { ...previous.preferences, theme: themeToSelect } }) : previous)
        setTheme(themeToSelect)
        applyTheme(themeToSelect)
    }

    const itemClasses = "flex items-center gap-4 px-2 py-1 rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"

    return (
        <Select.Root value={theme} onValueChange={handleChangeTheme}>
            <Select.Trigger className={entryClasses + " gap-4"} aria-label="Theme">
                <Select.Value placeholder="Select theme…" />
                <Select.Icon>
                    <ChevronDownIcon />
                </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
                <Select.Content className="text-white light:text-black bg-gray-900 light:bg-gray-100">
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
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

function DeleteChatsEntryItem() {
    const { setChats } = useChat()

    function handleDeleteChats() {
        deleteChats().then(response => {
            if (response.ok) {
                if (location.pathname.includes("chat")) {
                    location.href = "/"
                } else {
                    setChats([])
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
    const { user } = useAuth()

    const [isOpen, setIsOpen] = useState(false)
    const [password, setPassword] = useState("")
    const [mfaCode, setMFACode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) {
            setPassword("")
            setMFACode("")
            setIsLoading(false)
            setError(null)
        }
    }, [isOpen])

    async function handleConfirmDelete() {
        setError(null)

        if (!password) {
            setError("Password is required to delete the account.")
            return
        }

        if (user?.mfa?.is_enabled && !mfaCode) {
            setError("MFA code is required.")
            return
        }

        try {
            setIsLoading(true)
            const response = await deleteAccount(password, user?.mfa?.is_enabled ? mfaCode : undefined)
            if (response.ok) {
                location.reload()
            } else {
                const json = await response.json().catch(() => ({}))
                setError(json.error || "Deletion of account was not possible")
            }
        } catch (err) {
            setError("Network or server error")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Trigger className={destructiveEntryClasses} data-testid="open-delete-account">
                Delete
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content className="fixed w-80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 rounded-xl bg-gray-800 light:bg-gray-200 text-white light:text-black">
                    <div className="flex justify-between items-center mb-2">
                        <Dialog.Title className="text-lg font-semibold">Delete Account</Dialog.Title>
                        <Dialog.Description hidden>Delete Account</Dialog.Description>
                        <Dialog.Close className="p-1 rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon />
                        </Dialog.Close>
                    </div>

                    <div className="text-sm mb-3">This action cannot be undone. Enter your password{user?.mfa?.is_enabled ? " and MFA code" : ""} to confirm.</div>

                    <div className="flex flex-col gap-2">
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password"
                            className="px-2 py-1 rounded border bg-gray-900 light:bg-white light:text-black"
                            disabled={isLoading}
                        />

                        {user?.mfa?.is_enabled && (
                            <input
                                type="text"
                                value={mfaCode}
                                onChange={e => setMFACode(e.target.value)}
                                placeholder="MFA code"
                                className="px-2 py-1 rounded border bg-gray-900 light:bg-white light:text-black"
                                disabled={isLoading}
                            />
                        )}

                        {error && <div className="text-red-400 text-sm">{error}</div>}

                        <div className="flex justify-end gap-2 mt-2">
                            <Dialog.Close asChild>
                                <button className={entryClasses} disabled={isLoading}>Cancel</button>
                            </Dialog.Close>
                            <button className={destructiveEntryClasses} onClick={handleConfirmDelete} disabled={isLoading}>
                                {isLoading ? "Deleting..." : "Delete Account"}
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
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
        <div className="flex gap-3 md:gap-20 py-2 items-center justify-between">
            <label>{name}</label>
            {item}
        </div>
    )
}

const entryClasses = `
    flex px-2 py-1 items-center justify-center rounded-lg cursor-pointer
    border border-gray-500
    hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300
`
const destructiveEntryClasses = entryClasses + " text-red-500"