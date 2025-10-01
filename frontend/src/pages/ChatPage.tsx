import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"

import type { Chat as ChatType, Message, MessageFile } from "../types"
import { getChats, getMessages, newMessage } from "../utils/api"

function Buttons() {
    return (
        <div className="flex flex-col gap-1">
            <button>Toggle Sidebar</button>
            <a href="/">New Chat</a>
            <button>Search chats</button>
        </div>
    )
}

function History() {
    const [chats, setChats] = useState<ChatType[]>([])

    useEffect(() => {
        getChats(0, 20).then(response => {
            if (response.ok) {
                response.json().then(data => {
                    setChats(data.chats)
                })
            }
        })
    }, [])

    return (
        <div className="flex flex-col bg-gray-800/50 light:bg-gray-200/50">
            {chats.map(c => (
                <a key={c.uuid} href={`/chat/${c.uuid}`}>{c.title}</a>
            ))}
        </div>
    )
}

function Sidebar() {
    return (
        <div className="flex flex-col w-60 text-center bg-gray-800 light:bg-gray-200">
            <Buttons />
            <History />
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

function Messages({ messages, setMessages }: { messages: Message[], setMessages: React.Dispatch<React.SetStateAction<Message[]>> }) {
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

function Attachment({ file }: { file: MessageFile }) {
    return (
        <div className="flex bg-gray-800 light:bg-gray-200">
            {file.name}
        </div>
    )
}

function Attachments({ files }: { files: MessageFile[] }) {
    return (
        <div className="flex flex-col gap-2">
            {files.map(f => (
                <Attachment key={f.id} file={f} />
            ))}
        </div>
    )
}

function TextArea({ text, setText, sendMessage }: {
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    sendMessage: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
    return (
        <textarea
            className="px-6 py-1 content-center rounded-3xl resize-none outline-none bg-gray-700 light:bg-gray-300"
            placeholder="Type your message here..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={sendMessage}
            autoFocus
        />
    )
}

function Prompt({ setMessages }: { setMessages: React.Dispatch<React.SetStateAction<Message[]>> }) {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

    const [text, setText] = useState("")
    const [files, setFiles] = useState<File[]>([])

    function sendMessage() {
        newMessage(chatUUID || "", text, "SmolLM2-135M", files).then(response => {
            if (response.ok) {
                setMessages(previous => {
                    previous = [...previous]

                    const highestID = previous.map(p => p.id).sort().at(-1) || 1
                    const highestFileID = previous.flatMap(p => p.files).map(f => f.id).sort().at(-1) || 1
                    const newFiles = files.map((f, i) => ({
                        id: highestFileID + i + 1,
                        name: f.name,
                        content_size: f.size,
                        content_type: f.type
                    }))

                    previous.push({ id: highestID + 1, text, files: newFiles, is_from_user: true, model: undefined })
                    previous.push({ id: highestID + 2, text: "", files: [], is_from_user: false, model: "SmolLM2-135M" })

                    return previous
                })

                setText("")
                setFiles([])

                response.json().then(chat => {
                    navigate(`/chat/${chat.uuid}`)
                })
            } else {
                alert("Failed to send message")
            }
        })
    }

    function sendMessageWithEvent(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && (text.trim() !== "" || files.length > 0)) {
            sendMessage()
        }
    }

    return (
        <div className="flex flex-col w-[60vw] mt-auto mb-5 rounded-3xl bg-gray-700 light:bg-gray-300">
            <Attachments files={files.map((f, i) => ({ id: i, name: f.name, content_size: f.size, content_type: f.type }))} />
            <TextArea text={text} setText={setText} sendMessage={sendMessageWithEvent} />
        </div>
    )
}

function Chat() {
    const [messages, setMessages] = useState<Message[]>([])

    return (
        <div className="flex flex-col size-full items-center">
            <Messages messages={messages} setMessages={setMessages} />
            <Prompt setMessages={setMessages} />
        </div>
    )
}

export default function ChatPage() {
    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-gray-900 light:text-black light:bg-gray-100">
            <Sidebar />
            <Chat />
        </div>
    )
}