import { useParams } from "react-router";

import { useEffect, useRef, useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronLeftIcon, ChevronRightIcon, DotsVerticalIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import "./ChatPage.css"
import type { Chat, Message } from "../types";
import { getChats, getMessages } from "../utils/api";

export default function ChatPage() {
    const { chatUUID } = useParams()

    const webSocket = useRef<WebSocket>(null)

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [prompt, setPrompt] = useState("")

    const shouldLoadChats = useRef(true)
    const shouldLoadMessages = useRef(true)

    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    useEffect(() => {
        loadChats()
        loadMessages()
        receiveMessage()
    }, [])

    useEffect(() => {
        document.querySelector("textarea")?.focus()
    }, [])

    function loadChats() {
        if (shouldLoadChats.current) {
            shouldLoadChats.current = false
            getChats().then(setChats)
        }
    }

    function loadMessages() {
        if (shouldLoadMessages.current && chatUUID) {
            shouldLoadMessages.current = false
            getMessages(chatUUID).then(setMessages)
        }
    }

    function receiveMessage() {
        if (!webSocket.current) {
            webSocket.current = new WebSocket(chatUUID ? `ws://${location.host}/ws/chat/${chatUUID}/` : `ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("message", event => {
                const data = JSON.parse(event.data)

                const message_index = data.message_index + 1

                if (data.message) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[message_index] = { text: data.message, files: [], is_user_message: false }
                        return messages
                    })
                } else if (data.token) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[message_index] = { text: messages[message_index].text + data.token, files: [], is_user_message: false }
                        return messages
                    })
                } else if (data.redirect) {
                    location.href = data.redirect
                }
            })

            webSocket.current.addEventListener("error", _ => {
                if (chatUUID) {
                    location.href = "/"
                }
            })
        }
    }

    function sendMessage(event: React.KeyboardEvent) {
        if (webSocket.current && event.key === "Enter" && !event.shiftKey && prompt.trim()) {
            event.preventDefault()
            getChats(true).then(chats => {
                if (chats.length === 0 && webSocket.current) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages.push({ text: prompt, files: [], is_user_message: true })
                        messages.push({ text: "", files: [], is_user_message: false })
                        return messages
                    })

                    webSocket.current.send(JSON.stringify({ message: prompt }))
                    setPrompt("")
                }
            })
        }
    }

    return (
        <div className="flex h-screen w-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <div
                className={`flex flex-col bg-gray-800 transition-all duration-300 h-full ${isSidebarOpen ? "w-[250px]" : "w-[50px]"
                    }`}
            >
                {/* Sidebar top buttons */}
                <div className="flex flex-col gap-2 p-2 border-b border-gray-700">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-700"
                    >
                        {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                        {isSidebarOpen && <span>Toggle Sidebar</span>}
                    </button>

                    <a
                        href="/"
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-700"
                    >
                        <PlusIcon />
                        {isSidebarOpen && <span>New Chat</span>}
                    </a>

                    <button className="flex items-center gap-2 p-2 rounded hover:bg-gray-700">
                        <MagnifyingGlassIcon />
                        {isSidebarOpen && <span>Search</span>}
                    </button>
                </div>

                {/* Chat history */}
                {isSidebarOpen && (
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {chats.map(chat => (
                            <div
                                key={chat.uuid}
                                className="flex items-center justify-between bg-gray-700 rounded p-2 hover:bg-gray-600"
                            >
                                <a href={`/chat/${chat.uuid}`} className="truncate flex-1">
                                    {chat.title}
                                </a>

                                <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild>
                                        <button className="p-1 hover:bg-gray-500 rounded">
                                            <DotsVerticalIcon />
                                        </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content className="bg-gray-700 rounded shadow-lg p-1">
                                        <DropdownMenu.Item className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer">
                                            Rename
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item className="px-3 py-1 hover:bg-gray-600 rounded cursor-pointer">
                                            Delete
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chat box */}
            <div className="flex-1 flex justify-center items-center">
                <div className="flex flex-col h-full w-[50vw]">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.is_user_message ? "justify-end" : "justify-center"}`}
                            >
                                {message.is_user_message ? (
                                    <div
                                        className="px-4 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap bg-gray-700 text-white"
                                    >
                                        {message.text}
                                    </div>
                                ) :
                                    (
                                        <div
                                            className="px-4 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap bg-transparent text-gray-300"
                                            dangerouslySetInnerHTML={{ __html: message.text }}
                                        ></div>
                                    )}
                            </div>
                        ))}
                    </div>

                    {/* Prompt input */}
                    <PromptBar prompt={prompt} setPrompt={setPrompt} sendMessage={sendMessage} />
                </div>
            </div>
        </div>
    )
}

function PromptBar({ prompt, setPrompt, sendMessage }: {
    prompt: string,
    setPrompt: (value: React.SetStateAction<string>) => void,
    sendMessage: (e: React.KeyboardEvent<Element>) => void
}) {

    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setPrompt(e.target.value)

        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = "auto" // reset height
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px" // grow up to 200px
        }
    }

    return (
        <div className="flex items-end p-4">
            <div className="prompt flex gap-2 w-full bg-gray-700 rounded-[50px] px-7 py-3">
                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={handleChange}
                    onKeyDown={sendMessage}
                    placeholder="Ask me anything..."
                    rows={1}
                    className="flex-1 resize-none text-white outline-none px-2"
                    style={{ maxHeight: "200px", overflowY: "auto" }}
                />
            </div>
        </div>
    )
}