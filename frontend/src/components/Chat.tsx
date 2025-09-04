import Messages from "./Messages"
import Prompt from "./Prompt"
import type { Chat as ChatType, Message, Model } from "../types"
import { useState } from "react"

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [model, setModel] = useState<Model>("SmolLM2-135M")
    const [pendingChat, setPendingChat] = useState<ChatType | undefined>()

    return (
        <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col w-full h-full">
                <Messages
                    messages={messages}
                    setMessages={setMessages}
                    pendingChat={pendingChat}
                    setPendingChat={setPendingChat}
                    model={model}
                    setModel={setModel}
                />
                <Prompt
                    setMessages={setMessages}
                    pendingChat={pendingChat}
                    setPendingChat={setPendingChat}
                    model={model}
                    setModel={setModel}
                />
            </div>
        </div>
    )
}