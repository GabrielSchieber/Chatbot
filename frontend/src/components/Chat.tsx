import { useEffect, useState } from "react"

import Messages from "./Messages"
import Prompt from "./Prompt"
import type { Chat as ChatType, Message } from "../types"
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