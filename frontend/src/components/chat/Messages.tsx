import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import Bot from "./messages/Bot"
import Editor from "./messages/Editor"
import { User } from "./messages/User"
import { useChat } from "../../context/ChatProvider"
import { getMessages } from "../../utils/api"

export default function Messages() {
    const { chatUUID } = useParams()

    const { messages, setMessages, setPendingChat } = useChat()

    const webSocket = useRef<WebSocket | null>(null)
    const ref = useRef<HTMLDivElement | null>(null)

    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)

    const [editingMessageIndex, setEditingMessageIndex] = useState(-1)

    function handleScroll() {
        if (!ref.current) return
        const atBottom = ref.current.scrollHeight - ref.current.clientHeight - ref.current.scrollTop <= 20
        if (!atBottom) setShouldScrollToBottom(false)
    }

    useEffect(() => {
        if (chatUUID) {
            getMessages(chatUUID).then(response => {
                if (response.ok) {
                    response.json().then(data => setMessages(data))
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
                } else if (data === "end") {
                    setPendingChat(null)
                }
            })

            webSocket.current.addEventListener("error", _ => location.href = "/")
        }

        if (webSocket.current.readyState === WebSocket.OPEN && chatUUID) {
            webSocket.current.send(JSON.stringify({ chat_uuid: chatUUID }))
        }
    }, [chatUUID])

    useEffect(() => setShouldScrollToBottom(true), [messages.length])

    useEffect(() => {
        if (shouldScrollToBottom) {
            requestAnimationFrame(_ => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "auto" }))
        }
    }, [shouldScrollToBottom, messages.at(-1)?.text])

    return (
        <div
            ref={ref}
            className="flex flex-col size-full px-5 items-center overflow-y-auto"
            style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
            onScroll={handleScroll}
        >
            {messages.map((m, i) => (
                <div key={m.id} className={`flex flex-col gap-0.5 w-[60vw] justify-self-center ${m.is_from_user ? "items-end" : "items-start"}`}>
                    {editingMessageIndex === i ? (
                        <Editor index={editingMessageIndex} setIndex={setEditingMessageIndex} />
                    ) : (
                        m.is_from_user ? (
                            <User text={m.text} files={m.files} onEditClick={() => setEditingMessageIndex(i)} />
                        ) : (
                            <Bot index={i} text={m.text} model={m.model} />
                        )
                    )}
                </div>
            ))}
        </div>
    )
}