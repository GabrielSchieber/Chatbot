import { ArrowUpIcon, BoxModelIcon, PlusIcon } from "@radix-ui/react-icons"
import { useState, useRef } from "react"
import { useNavigate, useParams } from "react-router"

import Button from "../components/ui/Button"
import Dropdown from "../components/ui/Dropdown"
import Attachment from "../components/ui/Attachment"
import TextArea from "../components/ui/TextArea"
import { MAX_FILE_SIZE, MAX_FILES } from "../constants/files"
import { newMessage } from "../utils/api"
import { getFileSize } from "../utils/file"
import type { Chat, Message, Model } from "../types"

export default function Prompt({ setMessages, pendingChat, setPendingChat }: {
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    pendingChat: Chat | null
    setPendingChat: React.Dispatch<React.SetStateAction<Chat | null>>
}) {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [text, setText] = useState("")
    const [files, setFiles] = useState<File[]>([])
    const [model, setModel] = useState<Model>("SmolLM2-135M")

    function sendMessage() {
        newMessage(chatUUID || "", text, model, files).then(response => {
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
                    previous.push({ id: highestID + 2, text: "", files: [], is_from_user: false, model })

                    return previous
                })

                setText("")
                setFiles([])

                response.json().then(chat => {
                    navigate(`/chat/${chat.uuid}`)
                    setPendingChat(chat)
                })
            } else {
                alert("Failed to send message")
            }
        })
    }

    function sendMessageWithEvent(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && (text.trim() !== "" || files.length > 0)) {
            e.preventDefault()
            sendMessage()
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return

        if (files.length + e.target.files.length > MAX_FILES) {
            alert(`You can only attach up to ${MAX_FILES} files at a time.`)
            e.target.value = ""
            return
        }

        const newFiles = Array.from(e.target.files)

        const currentTotal = files.map(f => f.size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)

        if (currentTotal + newTotal > MAX_FILE_SIZE) {
            alert(`Total file size exceeds ${getFileSize(MAX_FILE_SIZE)} limit. Please select smaller files.`)
            e.target.value = ""
            return
        }

        const currentKeys = new Set(files.map(f => f.name + "|" + f.size))
        const newUniqueFiles = newFiles.filter(f => !currentKeys.has(f.name + "|" + f.size))

        setFiles(previous => [...previous, ...newUniqueFiles])

        e.target.value = ""
    }

    return (
        <div className="flex w-[60vw] h-auto mb-5 px-2 items-end rounded-3xl bg-gray-700 light:bg-gray-300">
            <div className="flex gap-0.5 items-center">
                <Button icon={<PlusIcon className="size-6" />} onClick={() => fileInputRef.current?.click()} />
                <Dropdown icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple />
            <div className="flex flex-1 flex-col max-h-[50vh] overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                <div className="flex flex-col gap-2 items-start">
                    {files.map((f, i) => (
                        <Attachment key={f.name + "|" + f.size} file={{ id: i, name: f.name, content_size: f.size, content_type: f.type }} onRemove={() => setFiles(previous => previous.filter(p => p.name + "|" + p.size !== f.name + "|" + f.size))} />
                    ))}
                </div>
                <TextArea text={text} setText={setText} onKeyDown={sendMessageWithEvent} autoFocus />
            </div>
            {(text.trim() !== "" || files.length > 0) && <Button icon={<ArrowUpIcon className="size-6" />} isDisabled={pendingChat !== null} onClick={sendMessage} />}
        </div>
    )
}