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
    const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(-1)

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
        <div className="history flex flex-col gap-1 p-2 w-full h-full p-1 overflow-x-hidden overflow-y-auto">
            <p className="pl-2 text-sm text-gray-400">Chats</p>
            {chats.map((chat, index) => (
                <div
                    key={chat.uuid}
                    className={`
                        flex group px-2 py-1 justify-between rounded
                        ${(chatUUID === chat.uuid || renameChatUUID === chat.uuid) && "bg-gray-700 light:bg-gray-400/40"}
                        ${selectedDropdownIndex === index ? "bg-gray-600 light:bg-gray-300" : "hover:bg-gray-600 light:hover:bg-gray-300"}
                    `}
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

                    <DropdownMenu.Root onOpenChange={o => setSelectedDropdownIndex(o ? index : -1)}>
                        <DropdownMenu.Trigger
                            className="
                                h-full py-1 self-center outline-none rounded hover:bg-gray-500 
                                light:hover:bg-gray-400 focus:bg-gray-500 light:focus:bg-gray-400
                            "
                        >
                            <DotsVerticalIcon />
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content className="bg-gray-700 light:bg-gray-200 p-2 rounded-xl shadow-xl/30 translate-x-7" sideOffset={2}>
                            <DropdownMenu.Item
                                className="
                                    px-4 py-2 text-center outline-none rounded-xl select-none cursor-pointer
                                    hover:bg-gray-600 light:hover:bg-gray-300 focus:bg-gray-600 light:focus:bg-gray-300
                                "
                                onSelect={_ => startRename(chat)}
                            >
                                Rename
                            </DropdownMenu.Item>

                            <ConfirmDialog
                                trigger={
                                    <DropdownMenu.Item
                                        className="
                                            px-4 py-2 text-center text-red-400 outline-none rounded-xl
                                            select-none cursor-pointer hover:bg-red-300/30 focus:bg-red-300/40
                                        "
                                        onSelect={e => e.preventDefault()}
                                    >
                                        Delete
                                    </DropdownMenu.Item>
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