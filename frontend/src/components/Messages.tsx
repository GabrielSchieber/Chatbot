import { useEffect, useRef } from "react"
import { useParams } from "react-router"

import { getMessages } from "../utils/api"
import type { Message as MessageType } from "../types"

export default function Messages({ messages, setMessages }: { messages: MessageType[], setMessages: React.Dispatch<React.SetStateAction<MessageType[]>> }) {
    const { chatUUID } = useParams()

    const webSocket = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (chatUUID) {
            getMessages(chatUUID).then(response => {
                if (response.ok) {
                    response.json().then(data => {
                        setMessages(data)
                    })
                } else {
                    alert("Failed to get messages")
                }
            })
        }

        if (!webSocket.current) {
            webSocket.current = new WebSocket(`ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("open", _ => {
                if (webSocket.current && chatUUID) {
                    webSocket.current.send(JSON.stringify({ chat_uuid: chatUUID }))
                }
            })

            webSocket.current.addEventListener("message", e => {
                const data = JSON.parse(e.data)

                if (data.token || data.message) {
                    let shouldSetMessages = true
                    setMessages(previous => {
                        if (shouldSetMessages) {
                            shouldSetMessages = false

                            previous = [...previous]

                            const message = previous[data.message_index]
                            if (message) {
                                if (data.token) {
                                    message.text += data.token
                                } else {
                                    message.text = data.message
                                }
                            }
                        }

                        return previous
                    })
                }
            })

            webSocket.current.addEventListener("error", _ => location.href = "/")
        }

        if (webSocket.current.readyState === WebSocket.OPEN && chatUUID) {
            webSocket.current.send(JSON.stringify({ chat_uuid: chatUUID }))
        }
    }, [chatUUID])

    return (
        <div className="flex flex-col w-[60vw]">
            {messages.map(m => (
                <Message key={m.id} text={m.text} isFromUser={m.is_from_user} />
            ))}
        </div>
    )
}

function Message({ text, isFromUser }: { text: string, isFromUser: boolean }) {
    return (
        isFromUser ? (
            <div className="w-[50%] whitespace-pre-wrap">
                {text}
            </div>
        ) : (
            <div className="w-full whitespace-pre-wrap">
                {text}
            </div>
        )
    )
}