import { CheckIcon, ChevronDownIcon, ChevronUpIcon, Cross1Icon, GearIcon } from "@radix-ui/react-icons"
import { Dialog, Select } from "radix-ui"
import { type ReactNode } from "react"

import ConfirmDialog from "./ConfirmDialog"
import { deleteAccount, deleteChats } from "../utils/api"
import { logout } from "../utils/auth"
import { useTheme } from "../context/ThemeProvider"

export default function Settings({ isSidebarOpen }: { isSidebarOpen: boolean }) {
    const { theme, setTheme } = useTheme()

    const entryClasses = "px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-600 light:border-gray-800 light:hover:bg-gray-400"
    const destructiveEntryClasses = entryClasses + " text-red-500"

    function Entry({ name, item }: { name: string, item: ReactNode }) {
        return (
            <div className="flex justify-between items-center border-b py-2">
                <label>{name}</label>
                {item}
            </div>
        )
    }

    function ThemeSelect() {
        const itemClasses = "flex items-center px-2 py-1 rounded cursor-pointer hover:bg-gray-500 light:hover:bg-gray-300"

        return (
            <Select.Root value={theme} onValueChange={setTheme}>
                <Select.Trigger
                    className={entryClasses + " inline-flex items-center justify-between w-30"}
                    aria-label="Theme"
                >
                    <Select.Value placeholder="Select theme…" />
                    <Select.Icon>
                        <ChevronDownIcon />
                    </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                    <Select.Content className="overflow-hidden rounded-md shadow-lg text-white bg-gray-600 light:text-black light:bg-gray-200">
                        <Select.ScrollUpButton>
                            <ChevronUpIcon />
                        </Select.ScrollUpButton>
                        <Select.Viewport className="p-1">
                            <Select.Item value="system" className={itemClasses}>
                                <Select.ItemText>System</Select.ItemText>
                                <Select.ItemIndicator className="ml-auto">
                                    <CheckIcon />
                                </Select.ItemIndicator>
                            </Select.Item>
                            <Select.Item value="light" className={itemClasses}>
                                <Select.ItemText>Light</Select.ItemText>
                                <Select.ItemIndicator className="ml-auto">
                                    <CheckIcon />
                                </Select.ItemIndicator>
                            </Select.Item>
                            <Select.Item value="dark" className={itemClasses}>
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

    function handleDeleteChats() {
        deleteChats().then(status => {
            if (status === 200) {
                if (location.pathname.includes("chat")) {
                    location.href = "/"
                } else {
                    const historyPanel = document.querySelector(".history")
                    if (historyPanel) {
                        historyPanel.innerHTML = ""
                    }
                }
            } else {
                alert("Deletion of chats was not possible")
            }
        })
    }

    function handleDeleteAccount() {
        deleteAccount().then(status => {
            if (status === 200) {
                location.reload()
            } else {
                alert("Deletion of account was not possible")
            }
        })
    }

    function handleLogout() {
        logout()
        location.reload()
    }

    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <button className="flex justify-center items-center p-2 gap-2 rounded hover:bg-gray-700 light:hover:bg-gray-300 outline-none">
                    <GearIcon />
                    {isSidebarOpen && <span>Settings</span>}
                </button>
            </Dialog.Trigger>

            <Dialog.Overlay className="fixed inset-0 bg-black/60" />

            <Dialog.Content
                className="
                    fixed flex flex-col gap-5 w-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    p-6 rounded-xl bg-gray-800 light:bg-gray-300 light:text-black
                "
            >
                <div className="flex justify-between items-center">
                    <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
                    <Dialog.Close asChild>
                        <button className="p-2 rounded-3xl outline-none hover:bg-gray-700 light:hover:bg-gray-200">
                            <Cross1Icon className="size-5" />
                        </button>
                    </Dialog.Close>
                </div>

                <div className="flex flex-col border-t-2">
                    <Entry name="Theme" item={ThemeSelect()} />
                    <Entry
                        name="Delete chats"
                        item={
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
                        }
                    />
                    <Entry
                        name="Delete account"
                        item={
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
                        }
                    />
                    <Entry
                        name="Log out"
                        item={
                            <button className={entryClasses} onClick={handleLogout}>
                                Log out
                            </button>
                        }
                    />
                </div>
            </Dialog.Content>
        </Dialog.Root>
    )
}