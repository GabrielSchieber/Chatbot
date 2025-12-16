import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import { getChat, getChats, getMessageFileContent, getMessages } from "../utils/api"
import { getFileType } from "../utils/misc"
import type { Chat, Message } from "../utils/types"

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { chatUUID } = useParams()

    const shouldSet = useRef(true)

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 750)
    const [isTemporaryChat, setIsTemporaryChat] = useState(false)

    useEffect(() => {
        if (!shouldSet.current) return
        shouldSet.current = false

        if (chatUUID) {
            getChat(chatUUID).then(async response => {
                if (response.ok) {
                    const chat = await response.json()
                    setChats(previous => !previous.find(c => c.uuid === chat.uuid) ? [...previous, chat] : previous)
                }
            })

            getMessages(chatUUID).then(async response => {
                if (response.ok) {
                    const fetchedMessages: Message[] = await response.json()
                    setMessages(fetchedMessages)

                    for (const m of fetchedMessages) {
                        for (const f of m.files) {
                            if (getFileType(f.name) === "Image" && f.content === null) {
                                const contentResponse = await getMessageFileContent(chatUUID, f.id)
                                if (response.ok) {
                                    const fetchedContent = await contentResponse.blob()
                                    setMessages(previous =>
                                        previous.map(
                                            p => p.id !== m.id ? p :
                                                { ...p, files: p.files.map(file => file.id === f.id ? { ...file, content: fetchedContent } : file) }
                                        )
                                    )
                                }
                            }
                        }
                    }
                } else {
                    location.href = "/"
                }
            })
        }

        getChats(0, 1, true).then(async response => {
            if (response.ok) {
                const chats = await response.json()
                if (chats.length > 0) {
                    setChats(previous => [...previous, ...chats])
                }
                setIsLoading(false)
            }
        })
    }, [])

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 750)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    return (
        <ChatContext.Provider value={{ chats, setChats, messages, setMessages, isLoading, isMobile, isTemporaryChat, setIsTemporaryChat }}>
            {children}
        </ChatContext.Provider>
    )
}

export function useChat() {
    const context = useContext(ChatContext)
    if (!context) throw new Error("useChat must be used inside ChatProvider")
    return context
}

interface ChatContextValue {
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    isLoading: boolean
    isMobile: boolean
    isTemporaryChat: boolean
    setIsTemporaryChat: React.Dispatch<React.SetStateAction<boolean>>
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined)