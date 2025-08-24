import Messages from "./Messages";
import Prompt from "./Prompt";
import type { Message } from "../types";
import { useRef, useState } from "react";

export default function Chat() {
    const webSocket = useRef<WebSocket>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [isAnyChatIncomplete, setIsAnyChatIncomplete] = useState(false)

    return (
        <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col w-full h-full">
                <Messages
                    webSocket={webSocket}
                    messages={messages}
                    setMessages={setMessages}
                    isAnyChatIncomplete={isAnyChatIncomplete}
                    setIsAnyChatIncomplete={setIsAnyChatIncomplete}
                />
                <Prompt
                    webSocket={webSocket}
                    setMessages={setMessages}
                    isAnyChatIncomplete={isAnyChatIncomplete}
                    setIsAnyChatIncomplete={setIsAnyChatIncomplete}
                />
            </div>
        </div>
    )
}