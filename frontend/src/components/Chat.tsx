import { useState } from "react"

import type { Message } from "../types"
import Messages from "./Messages"
import Prompt from "./Prompt"

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([])

    return (
        <div className="flex flex-col size-full items-center">
            <Messages messages={messages} setMessages={setMessages} />
            <Prompt setMessages={setMessages} />
        </div>
    )
}