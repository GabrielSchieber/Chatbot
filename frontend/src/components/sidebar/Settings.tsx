import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Cross1Icon, GearIcon } from "@radix-ui/react-icons"
import { Dialog, Select } from "radix-ui"
import { useState, type ReactNode } from "react"

import ConfirmDialog from "../ui/ConfirmDialog"
import MFADialog from "../ui/MFADialog"
import { TooltipButton } from "../ui/Buttons"
import { useAuth } from "../../context/AuthProvider"
import { useChat } from "../../context/ChatProvider"
import { archiveChats, archiveOrUnarchiveChat, deleteAccount, deleteChat, deleteChats, getArchivedChats, logout, me } from "../../utils/api"
import { applyTheme } from "../../utils/theme"
import type { Chat, Theme } from "../../types"

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
                        <Dialog.Description hidden>Manage settings</Dialog.Description>
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-200" data-testid="close-settings">
                            <Cross1Icon className="size-5" />
                        </Dialog.Close>
                    </div>

                    {user && <div className="font-semibold">Email: {user.email}</div>}

                    <div className="flex flex-col border-t-2">
                        <Entry name="Theme" item={<ThemeEntryItem />} />
                        <Entry name="Multi-factor authentication" item={<MFADialog triggerClassName={entryClasses} />} />
                        <Entry name="Archived chats" item={<ManageArchivedChatsEntryItem />} />
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

function ManageArchivedChatsEntryItem() {
    const { setCurrentChat, setChats } = useChat()

    const [archivedChats, setArchivedChats] = useState<Chat[]>([])
    const [isLoading, setIsLoading] = useState(true)

    function loadArchivedChats() {
        getArchivedChats().then(response => {
            if (response.ok) {
                response.json().then(data => {
                    setArchivedChats(data.chats)
                    setIsLoading(false)
                })
            }
        })
    }

    function handleUnarchive(chat: Chat) {
        archiveOrUnarchiveChat(chat.uuid, false)
        setArchivedChats(previous => previous.filter(p => p.uuid !== chat.uuid))
        setChats(previous => [...previous, chat].sort((a, b) => a.index - b.index))
        setCurrentChat(previous => previous?.uuid === chat.uuid ? { ...previous, is_archived: false } : previous)
    }

    function handleDelete(uuid: string) {
        deleteChat(uuid).then(response => {
            if (response.ok) {
                setChats(previous => {
                    let previousChats = [...previous]
                    previousChats = previousChats.filter(c => c.uuid !== uuid)
                    return previousChats
                })
                if (location.pathname.includes(uuid)) {
                    location.href = "/"
                }
            }
        })
    }

    return (
        <Dialog.Root onOpenChange={o => o && loadArchivedChats()}>
            <Dialog.Trigger className={entryClasses}>
                Manage
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed flex flex-col w-150 top-[20vh] left-1/2 -translate-x-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <div className="flex p-4 items-center justify-between border-b">
                        <Dialog.Title className="text-lg font-semibold">Archived Chats</Dialog.Title>
                        <Dialog.Description hidden>Manage archived chats</Dialog.Description>
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-200" data-testid="close-settings">
                            <Cross1Icon className="size-5" />
                        </Dialog.Close>
                    </div>

                    {archivedChats.length > 0 ? (
                        <div
                            className="flex-1 gap-1 px-4 py-2 max-h-[50vh] overflow-y-auto"
                            style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
                        >
                            {archivedChats.map(c => (
                                <a
                                    key={c.uuid}
                                    className="flex gap-2 px-2 py-1 items-center justify-between rounded-lg hover:bg-gray-700 light:bg-gray-300"
                                    href={`/chat/${c.uuid}`}
                                >
                                    {c.title}
                                    <div className="flex gap-1 items-center">
                                        <TooltipButton
                                            trigger={
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                                    <rect width="20" height="5" x="2" y="3" rx="1" />
                                                    <path d="M4 8v11a2 2 0 0 0 2 2h2" />
                                                    <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
                                                    <path d="m9 15 3-3 3 3" />
                                                    <path d="M12 12v9" />
                                                </svg>}
                                            tooltip="Unarchive"
                                            className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-500/40"
                                            onClick={e => {
                                                e.preventDefault()
                                                handleUnarchive(c)
                                            }}
                                            tooltipSize="xs"
                                        />
                                        <TooltipButton
                                            trigger={
                                                <ConfirmDialog
                                                    trigger={
                                                        <Cross1Icon className="size-4" />
                                                    }
                                                    title="Delete Archived Chat"
                                                    description={`Are you sure you want to delete "${c.title}"? This action cannot be undone.`}
                                                    confirmText="Delete"
                                                    cancelText="Cancel"
                                                    onConfirm={() => handleDelete(c.uuid)}
                                                />
                                            }
                                            onClick={e => e.preventDefault()}
                                            tooltip="Delete"
                                            className="p-1.5 rounded-3xl text-red-500 cursor-pointer hover:bg-red-500/20"
                                            tooltipSize="xs"
                                        />
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : isLoading ? (
                        <p className="text-gray-400 light:text-gray-600 px-4 py-2">Loading chats...</p>
                    ) : (
                        <p className="text-gray-400 light:text-gray-600 px-4 py-2">You don't have any archived chats.</p>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function ArchiveChatsEntryItem() {
    const { setCurrentChat, setChats } = useChat()

    function handleArchiveChats() {
        archiveChats().then(response => {
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