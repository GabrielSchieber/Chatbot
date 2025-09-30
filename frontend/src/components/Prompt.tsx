import React, { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"

import Attachments from "./Prompt/Attachments.tsx"
import Dropdown from "./Prompt/Dropdown.tsx"
import Input from "./Prompt/Input.tsx"
import Notification from "./Prompt/Notification.tsx"
import Pause from "./Prompt/Pause.tsx"
import Send from "./Prompt/Send.tsx"
import type { Chat, Message, Model, Options, UIAttachment } from "../types"
import { newMessage, stopPendingChats } from "../utils/api"

type PromptProps = {
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    pendingChat: Chat | undefined
    setPendingChat: React.Dispatch<React.SetStateAction<Chat | undefined>>
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
    options: Options
    setOptions: React.Dispatch<React.SetStateAction<Options>>
}

export default function Prompt({ setMessages, pendingChat, setPendingChat, model, setModel, options, setOptions }: PromptProps) {
    const navigate = useNavigate()
    const { chatUUID } = useParams()
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [prompt, setPrompt] = useState<string>("")
    const [currentFiles, setCurrentFiles] = useState<File[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])
    const [messageNotificationID, setMessageNotificationID] = useState(-1)

    const [isCentered, setIsCentered] = useState<boolean>(() => !chatUUID)
    useEffect(() => setIsCentered(!chatUUID), [chatUUID])

    function updateTextAreaHeight() {
        const textArea = textAreaRef.current
        if (textArea) {
            textArea.style.height = "auto"
            textArea.style.height = Math.min(textArea.scrollHeight, document.body.clientHeight * 0.5 - 50) + "px"
        }
    }

    function sendMessage() {
        setIsCentered(false)
        newMessage(chatUUID || "", model, options, prompt, currentFiles).then(([chat, status]) => {
            if (status === 200) {
                setPrompt("")
                setCurrentFiles([])
                setVisibleFiles([])

                setMessages(previous => {
                    previous = [...previous]

                    const highestCurrentFileID = previous.flatMap(message => message.files).map(file => file.id).sort().at(-1) || 1
                    const files = currentFiles.map((file, index) => ({
                        id: highestCurrentFileID + index + 1,
                        name: file.name,
                        content_size: file.size,
                        content_type: file.type
                    }))

                    const highestMessageID = previous.map(m => m.id).sort().at(-1) || 1
                    previous.push({ id: highestMessageID + 1, text: prompt, files: files, is_from_user: true, model: undefined })
                    previous.push({ id: highestMessageID + 2, text: "", files: [], is_from_user: false, model: model })

                    return previous
                })

                chat.then(chat => {
                    if (!chatUUID) {
                        navigate(`chat/${chat.uuid}`)
                    }
                    setPendingChat(chat)
                })
            } else {
                clearTimeout(messageNotificationID)
                setMessageNotificationID(window.setTimeout(() => setMessageNotificationID(-1), 2000))
            }
        })
    }

    function sendMessageWithEvent(event: React.KeyboardEvent) {
        if (event.key === "Enter" && !event.shiftKey && (prompt.trim() || currentFiles.length > 0)) {
            event.preventDefault()
            sendMessage()
        }
    }

    useEffect(() => updateTextAreaHeight(), [prompt, visibleFiles])

    window.addEventListener("resize", updateTextAreaHeight)

    const containerStyle: React.CSSProperties = {
        position: "absolute",
        left: "50%",
        top: isCentered ? "50%" : "100%",
        transform: isCentered ? "translate(-50%, 0)" : "translate(-50%, -100%)",
        transition: "top 320ms ease, transform 320ms ease",
        width: "50vw",
        paddingBottom: "1rem"
    }

    const headerStyle: React.CSSProperties = {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -120%)",
        transition: "opacity 160ms ease",
        opacity: isCentered ? 1 : 0,
        pointerEvents: "none",
        willChange: "opacity"
    }

    return (
        <>
            <h1 style={headerStyle} className="pb-5 text-3xl font-light">Hello! How can I help you today?</h1>
            <div style={containerStyle} className="flex flex-col pb-4" data-testid="prompt-bar">
                {messageNotificationID >= 0 && pendingChat && <Notification title={pendingChat.title} uuid={pendingChat.uuid} onClick={() => setMessageNotificationID(-1)} />}

                <div
                    className="
                        flex gap-2 w-full px-4 py-3 items-center rounded-[30px] cursor-text shadow-xl/50
                        border-t-4 border-gray-600 light:border-gray-400 bg-gray-700 light:bg-gray-300
                    "
                    onClick={e => {
                        if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                            return
                        }
                        textAreaRef.current?.focus()
                    }}
                >
                    <Dropdown
                        isPromptBarCentered={isCentered}
                        model={model}
                        setModel={setModel}
                        options={options}
                        setOptions={setOptions}
                        currentFiles={currentFiles}
                        setCurrentFiles={setCurrentFiles}
                        visibleFiles={visibleFiles}
                        setVisibleFiles={setVisibleFiles}
                        fileInputRef={fileInputRef}
                    />

                    <div className="flex flex-1 flex-col gap-3 max-h-100 overflow-y-auto">
                        <Attachments
                            currentFiles={currentFiles}
                            setCurrentFiles={setCurrentFiles}
                            visibleFiles={visibleFiles}
                            setVisibleFiles={setVisibleFiles}
                        />
                        <Input
                            ref={textAreaRef}
                            prompt={prompt}
                            setPrompt={setPrompt}
                            sendMessage={sendMessageWithEvent}
                        />
                    </div>

                    {(prompt.trim() || currentFiles.length > 0) && pendingChat === undefined &&
                        <Send sendMessage={sendMessage} />
                    }

                    {pendingChat !== undefined &&
                        <Pause stopPendingChats={stopPendingChats} setPendingChat={setPendingChat} />
                    }
                </div>
            </div>
        </>
    )
}