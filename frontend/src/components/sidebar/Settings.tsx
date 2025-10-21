import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Cross1Icon, GearIcon } from "@radix-ui/react-icons"
import { Dialog, Select } from "radix-ui"
import { useState, type ReactNode } from "react"

import { ArchivedChatsDialog } from "../ui/ArchivedChatsDialog"
import ConfirmDialog from "../ui/ConfirmDialog"
import MFADialog from "../ui/MFADialog"
import { useAuth } from "../../context/AuthProvider"
import { useChat } from "../../context/ChatProvider"
import { archiveOrUnarchiveChats, deleteAccount, deleteChats, logout, me } from "../../utils/api"
import { applyTheme } from "../../utils/theme"
import type { Theme } from "../../types"

export default function Settings({ isSidebarOpen, itemClassNames, getSidebarChatsLimit }: { isSidebarOpen: boolean, itemClassNames: string, getSidebarChatsLimit: () => number }) {
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
                        <Dialog.Description hidden>Manage settings</Dialog.Description>
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-200" data-testid="close-settings">
                            <Cross1Icon className="size-5" />
                        </Dialog.Close>
                    </div>

                    {user && <div className="font-semibold">Email: {user.email}</div>}

                    <div className="flex flex-col border-t-2">
                        <Entry name="Theme" item={<ThemeEntryItem />} />
                        <Entry name="Multi-factor authentication" item={<MFADialog triggerClassName={entryClasses} />} />
                        <Entry name="Archived chats" item={<ArchivedChatsDialog triggerClassName={entryClasses} getSidebarChatsLimit={getSidebarChatsLimit} />} />
                        <Entry name="Archive chats" item={<ArchiveChatsEntryItem />} />
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
    const { user, setUser } = useAuth()
    const [theme, setTheme] = useState(user?.preferences.theme || "System")

    function isTheme(value: unknown): value is Theme {
        return value === "System" || value === "Light" || value === "Dark"
    }

    function handleChangeTheme(themeValue: string) {
        const themeToSelect = isTheme(themeValue) ? themeValue : "System"
        me(themeToSelect)
        setUser(previous => previous ? ({ ...previous, preferences: { ...previous.preferences, theme: themeToSelect } }) : previous)
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

function ArchiveChatsEntryItem() {
    const { setCurrentChat, setChats } = useChat()

    function handleArchiveChats() {
        archiveOrUnarchiveChats(true).then(response => {
            if (response.ok) {
                setCurrentChat(previous => previous ? { ...previous, is_archived: true } : previous)
                setChats([])
            } else {
                alert("Archival of chats was not possible")
            }
        })
    }

    return (
        <button className={entryClasses} onClick={handleArchiveChats}>
            Archive all
        </button>
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