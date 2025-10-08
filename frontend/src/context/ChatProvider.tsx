import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import { getMessageFileContent, getMessages, getPendingChats } from "../utils/api"
import type { Chat, Message } from "../types"
import { getFileType } from "../utils/file"

interface ChatContextValue {
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    pendingChat: Chat | null
    setPendingChat: React.Dispatch<React.SetStateAction<Chat | null>>
    isLoading: boolean
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { chatUUID } = useParams()

    const shouldSet = useRef(true)

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [pendingChat, setPendingChat] = useState<Chat | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!shouldSet.current) return
        shouldSet.current = false

        if (chatUUID) {
            getMessages(chatUUID).then(response => {
                if (response.ok) {
                    response.json().then(data => {
                        setMessages(data)

                        for (const m of data) {
                            for (const f of m.files) {
                                if (getFileType(f.name) === "Image" && f.content === null) {
                                    getMessageFileContent(chatUUID, f.id).then(response => {
                                        if (response.ok) {
                                            response.blob().then(blob => {
                                                setMessages(previous =>
                                                    previous.map(p => (
                                                        p.id !== m.id ? p :
                                                            { ...p, files: p.files.map(file => file.id === f.id ? { ...file, content: blob } : file) }
                                                    ))
                                                )
                                            })
                                        }
                                    })
                                }
                            }
                        }
                    })
                }

            })
        }

        getPendingChats().then(response => {
            if (response.ok) {
                response.json().then(chats => {
                    if (chats.length > 0) {
                        setPendingChat(chats[0])
                    }
                    setIsLoading(false)
                })
            }
        })
    }, [])

    return (
        <ChatContext.Provider value={{ chats, setChats, messages, setMessages, pendingChat, setPendingChat, isLoading }}>
            {children}
        </ChatContext.Provider>
    )
}

export function useChat() {
    const context = useContext(ChatContext)
    if (!context) throw new Error("useChat must be used inside ChatProvider")
    return context
}