import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { AlertDialog, DropdownMenu } from "radix-ui"
import type { Chat } from "../types"
import { useState } from "react"
import { deleteChat, renameChat } from "../utils/api"
import { useParams } from "react-router"

export default function History({ chats, setChats }: {
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
}) {
    const { chatUUID } = useParams()
    const [renameChatUUID, setRenameChatUUID] = useState<string | null>(null)
    const [renameTitle, setRenameTitle] = useState("")

    function startRename(chat: Chat) {
        setRenameChatUUID(chat.uuid)
        setRenameTitle(chat.title)
        setTimeout(() => document.querySelector("input")?.focus(), 100)
    }

    function confirmRename(chat: Chat) {
        if (renameTitle.trim() && renameTitle !== chat.title) {
            renameChat(chat.uuid, renameTitle.trim())
            setChats(previous => {
                const previousChats = [...previous]
                const chatToRename = previousChats.find(c => c.uuid === chat.uuid)
                if (chatToRename) {
                    chatToRename.title = renameTitle.trim()
                }
                return previousChats
            })
        }
        setRenameChatUUID(null)
    }

    function handleDelete(uuid: string) {
        deleteChat(uuid).then(status => {
            if (status === 200) {
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
        <div className="history flex flex-col gap-1 w-full h-full p-1 overflow-x-hidden overflow-y-auto">
            {chats.map(chat => (
                <div
                    key={chat.uuid}
                    className={`flex group px-2 py-1 justify-between rounded hover:bg-gray-600 ${(chatUUID === chat.uuid || renameChatUUID === chat.uuid) && "bg-gray-700"}`}
                >
                    {renameChatUUID === chat.uuid ? (
                        <input
                            className="flex-1 rounded outline-none"
                            type="text"
                            value={renameTitle}
                            onChange={e => setRenameTitle(e.target.value)}
                            onBlur={_ => confirmRename(chat)}
                            onKeyDown={e => {
                                if (e.key === "Enter") confirmRename(chat)
                                if (e.key === "Escape") setRenameChatUUID(null)
                            }}
                            autoFocus
                        />
                    ) : (
                        <a className="flex-1 truncate" href={`/chat/${chat.uuid}`}>
                            {chat.title}
                        </a>
                    )}

                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className="hover:bg-gray-600 outline-none rounded">
                                <DotsVerticalIcon />
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content className="bg-gray-600 p-2 rounded">
                            <DropdownMenu.Item className="hover:bg-gray-700 p-2 text-center outline-none rounded" onSelect={_ => startRename(chat)}>
                                Rename
                            </DropdownMenu.Item>
                            <AlertDialog.Root>
                                <AlertDialog.Trigger asChild>
                                    <DropdownMenu.Item asChild onSelect={e => e.preventDefault()}>
                                        <button className="w-full text-center hover:bg-gray-700 p-2 outline-none rounded">
                                            Delete
                                        </button>
                                    </DropdownMenu.Item>
                                </AlertDialog.Trigger>

                                <AlertDialog.Portal>
                                    <AlertDialog.Overlay className="bg-black/50 fixed inset-0" />
                                    <AlertDialog.Content className="bg-gray-800 p-6 rounded-xl shadow-xl fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm">
                                        <AlertDialog.Title className="text-lg font-semibold text-white">
                                            Delete Chat
                                        </AlertDialog.Title>
                                        <AlertDialog.Description className="mt-2 text-sm text-gray-300">
                                            Are you sure you want to delete{" "}
                                            <span className="font-medium">{chat.title}</span>?
                                            This action cannot be undone.
                                        </AlertDialog.Description>

                                        <div className="mt-4 flex justify-end gap-2">
                                            <AlertDialog.Cancel asChild>
                                                <button className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white">
                                                    Cancel
                                                </button>
                                            </AlertDialog.Cancel>

                                            <AlertDialog.Action asChild>
                                                <button
                                                    className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white"
                                                    onClick={_ => handleDelete(chat.uuid)}
                                                >
                                                    Delete
                                                </button>
                                            </AlertDialog.Action>
                                        </div>
                                    </AlertDialog.Content>
                                </AlertDialog.Portal>
                            </AlertDialog.Root>
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>
            ))}
        </div>
    )
}