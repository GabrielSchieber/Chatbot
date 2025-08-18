import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import type { Chat } from "../types"
import { useState } from "react"
import { deleteChat, renameChat } from "../utils/api"
import { useParams } from "react-router"
import ConfirmDialog from "./ConfirmDialog"

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
                            <ConfirmDialog
                                trigger={
                                    <button className="w-full text-center hover:bg-gray-700 p-2 outline-none rounded">
                                        Delete
                                    </button>
                                }
                                title="Delete Chat"
                                description={`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`}
                                confirmText="Delete"
                                cancelText="Cancel"
                                onConfirm={() => handleDelete(chat.uuid)}
                            />
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>
            ))}
        </div>
    )
}