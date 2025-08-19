import { GearIcon } from "@radix-ui/react-icons";
import { Dialog } from "radix-ui";
import { deleteAccount, deleteChats } from "../utils/api";
import { logout } from "../utils/auth";
import ConfirmDialog from "./ConfirmDialog";

export default function Settings({ isSidebarOpen }: { isSidebarOpen: boolean }) {
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
                <button className="flex justify-center items-center p-2 gap-2 rounded hover:bg-gray-700 outline-none">
                    <GearIcon />
                    {isSidebarOpen && <span>Settings</span>}
                </button>
            </Dialog.Trigger>

            <Dialog.Overlay className="fixed inset-0 bg-black/60" />

            <Dialog.Content
                className="fixed flex flex-col gap-5 top-1/2 left-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white rounded-2xl shadow-lg p-6"
            >
                <div className="flex justify-between items-center">
                    <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
                    <Dialog.Close asChild>
                        <button
                            className="px-2 py-1 pb-1.5 content-center justify-center hover:bg-gray-700 rounded-[30px] text-xl outline-none transition-all duration-200 bg"
                        >
                            X
                        </button>
                    </Dialog.Close>
                </div>

                <div className="flex flex-col gap-5">
                    <div className="flex justify-between items-center">
                        <label>Theme</label>
                        <select className="bg-gray-900 rounded p-1 outline-none hover:bg-gray-700 transition-all duration-200 bg" defaultValue="system">
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>
                    <div className="flex justify-between items-center">
                        <label>Delete Chats</label>
                        <ConfirmDialog
                            trigger={
                                <button className="bg-gray-900 rounded px-2 py-1 hover:bg-gray-700 active:bg-gray-900 transition-all duration-200 bg">
                                    Delete all
                                </button>
                            }
                            title="Delete Chats"
                            description="Are you sure you want to delete all of your chats? This action cannot be undone."
                            confirmText="Delete all"
                            cancelText="Cancel"
                            onConfirm={handleDeleteChats}
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label>Delete Account</label>
                        <ConfirmDialog
                            trigger={
                                <button className="bg-gray-900 rounded px-2 py-1 hover:bg-gray-700 active:bg-gray-900 transition-all duration-200 bg">
                                    Delete
                                </button>
                            }
                            title="Delete Account"
                            description="Are you sure you want to delete your account? This action cannot be undone."
                            confirmText="Delete Account"
                            cancelText="Cancel"
                            onConfirm={handleDeleteAccount}
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label>Log out</label>
                        <button
                            className="bg-gray-900 rounded px-2 py-1 hover:bg-gray-700 active:bg-gray-900 transition-all duration-200 bg"
                            onClick={handleLogout}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    )
}