import { Cross1Icon, FileIcon } from "@radix-ui/react-icons"
import { useEffect, useState } from "react"

import Messages from "./Messages"
import Prompt from "./Prompt"
import { getFileSize, getFileType } from "../utils/file"
import type { Chat as ChatType, Message, MessageFile } from "../types"
import { getPendingChats } from "../utils/api"

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [pendingChat, setPendingChat] = useState<ChatType | null>(null)

    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        getPendingChats().then(response => {
            if (response.ok) {
                response.json().then(chats => {
                    if (chats.length > 0) {
                        setPendingChat(chats[0])
                    }
                    setIsLoading(false)
                })
            }
        })
    }, [])

    if (isLoading) {
        return <div className="flex flex-col size-full items-center justify-center">Loading...</div>
    } else {
        return (
            <div className="flex flex-col size-full items-center">
                <Messages messages={messages} setMessages={setMessages} pendingChat={pendingChat} setPendingChat={setPendingChat} />
                <Prompt setMessages={setMessages} pendingChat={pendingChat} setPendingChat={setPendingChat} />
            </div>
        )
    }
}

export function Attachment({ file, onRemove }: { file: MessageFile, onRemove?: () => void }) {
    return (
        <div className="flex px-4 gap-1 items-center rounded-md bg-gray-800 light:bg-gray-200">
            <FileIcon className="size-8" />
            <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                <p className="px-2 py-1 rounded-lg bg-gray-800">
                    Type: {getFileType(file.name)}<br />
                    Name: {file.name}<br />
                    Size: {getFileSize(file.content_size)}
                </p>
            </div>
            {onRemove &&
                <button className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={onRemove}>
                    <Cross1Icon className="size-3.5" />
                </button>
            }
        </div>
    )
}

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000