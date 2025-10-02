import { ArrowUpIcon, BoxModelIcon, PlusIcon } from "@radix-ui/react-icons"
import { useState, useRef } from "react"
import { useNavigate, useParams } from "react-router"

import Button from "../ui/Button"
import Dropdown from "../ui/Dropdown"
import TextArea from "../ui/TextArea"
import Attachments from "../ui/Attachments"
import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { useChat } from "../../context/ChatProvider"
import { newMessage } from "../../utils/api"
import { getFileSize } from "../../utils/file"
import type { Model } from "../../types"

export default function Prompt() {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

    const { setMessages, pendingChat, setPendingChat, isLoading } = useChat()

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
                <Attachments
                    files={files.map((f, i) => ({ id: i, name: f.name, content_size: f.size, content_type: f.type }))}
                    onRemove={file => setFiles(previous => previous.filter(f => f.name + "|" + f.size !== file.name + "|" + file.content_size))}
                />
                <TextArea text={text} setText={setText} onKeyDown={sendMessageWithEvent} autoFocus />
            </div>

            {(text.trim() !== "" || files.length > 0) &&
                <Button icon={<ArrowUpIcon className="size-6" />} isDisabled={pendingChat !== null || isLoading} onClick={sendMessage} />
            }
        </div>
    )
}