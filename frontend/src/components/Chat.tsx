import Messages from "./Messages"
import Prompt from "./Prompt"
import type { Chat as ChatType, Message, Model, Options } from "../types"
import { useState } from "react"

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([])
    const [model, setModel] = useState<Model>("SmolLM2-135M")
    const [options, setOptions] = useState<Options>({})
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
                    options={options}
                />
                <Prompt
                    setMessages={setMessages}
                    pendingChat={pendingChat}
                    setPendingChat={setPendingChat}
                    model={model}
                    setModel={setModel}
                    options={options}
                    setOptions={setOptions}
                />
            </div>
        </div>
    )
}