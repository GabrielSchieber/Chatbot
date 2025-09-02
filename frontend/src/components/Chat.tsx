import Messages from "./Messages"
import Prompt from "./Prompt"
import type { Message, Model, Options } from "../types"
import { useEffect, useRef, useState } from "react"

export default function Chat() {
    const webSocket = useRef<WebSocket>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [model, setModel] = useState<Model>(() => { return localStorage.getItem("model") as Model || "SmolLM2-135M" })

    const [isAnyChatIncomplete, setIsAnyChatIncomplete] = useState(false)

    function getStoredOptions() {
        const storedOptions = localStorage.getItem("options")
        if (storedOptions) {
            return JSON.parse(storedOptions)
        } else {
            return {
                max_tokens: 256,
                temperature: 0.2,
                top_p: 0.9,
                seed: 0
            }
        }
    }

    const [options, setOptions] = useState<Options>(() => getStoredOptions())

    useEffect(() => {
        localStorage.setItem("model", model)
    }, [model])

    return (
        <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col w-full h-full">
                <Messages
                    webSocket={webSocket}
                    messages={messages}
                    setMessages={setMessages}
                    isAnyChatIncomplete={isAnyChatIncomplete}
                    setIsAnyChatIncomplete={setIsAnyChatIncomplete}
                    model={model}
                    options={options}
                />
                <Prompt
                    webSocket={webSocket}
                    setMessages={setMessages}
                    isAnyChatIncomplete={isAnyChatIncomplete}
                    setIsAnyChatIncomplete={setIsAnyChatIncomplete}
                    model={model}
                    setModel={setModel}
                    options={options}
                    setOptions={setOptions}
                />
            </div>
        </div>
    )
}