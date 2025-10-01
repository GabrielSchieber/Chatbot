import { ArrowUpIcon, BoxModelIcon, CheckIcon, Cross1Icon, FileIcon, PlusIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useState, useEffect, useRef, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router"

import { newMessage } from "../utils/api"
import type { Message, MessageFile, Model } from "../types"
import { getFileSize, getFileType } from "../utils/file"

export default function Prompt({ setMessages }: { setMessages: React.Dispatch<React.SetStateAction<Message[]>> }) {
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

                response.json().then(chat => navigate(`/chat/${chat.uuid}`))
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
                <Attachments files={files} setFiles={setFiles} />
                <TextArea text={text} setText={setText} sendMessage={sendMessageWithEvent} />
            </div>
            {(text.trim() !== "" || files.length > 0) && <Button icon={<ArrowUpIcon className="size-6" />} onClick={sendMessage} />}
        </div>
    )
}

function Button({ icon, onClick }: { icon: ReactNode, onClick?: () => void }) {
    return <button
        className="my-2 p-1 rounded-3xl cursor-pointer hover:bg-gray-600 light:bg-gray-400"
        onClick={onClick}
    >
        {icon}
    </button>
}

function Dropdown({ icon, model, setModel }: {
    icon: ReactNode
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
}) {
    function Item({ m }: { m: Model }) {
        return (
            <DropdownMenu.Item
                className="p-2 rounded-md cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"
                onClick={_ => setModel(m)}
            >
                <div className="flex gap-2 items-center">
                    {m}{m === model && <CheckIcon className="size-5" />}
                </div>
            </DropdownMenu.Item>
        )
    }

    const models: Model[] = ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className="p-1 rounded-md cursor-pointer hover:bg-gray-600 light:bg-gray-400">
                {icon}
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-1 rounded-md bg-gray-800 light:bg-gray-200">
                {models.map(m => (
                    <Item key={m} m={m} />
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}

function Attachment({ file, onRemove }: { file: MessageFile, onRemove: () => void }) {
    return (
        <div className="flex px-4 gap-1 items-center rounded-md bg-gray-800 light:bg-gray-200">
            <FileIcon className="size-8" />
            <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                <p className="px-2 py-1 rounded-lg bg-gray-800">
                    Type: {getFileType(file.name)}<br />
                    Name: {file.name}<br />
                    Size: {getFileSize(file.content_size)}
                </p>
            </div>
            <button className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={onRemove}>
                <Cross1Icon className="size-3.5" />
            </button>
        </div>
    )
}

function Attachments({ files, setFiles }: { files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>> }) {
    const messageFiles = files.map((f, i) => ({ id: i, name: f.name, content_size: f.size, content_type: f.type }))
    return (
        <div className="flex flex-col gap-2 items-start">
            {messageFiles.map(f => (
                <Attachment key={f.id} file={f} onRemove={() => setFiles(previous => previous.filter(p => p.name + "|" + p.size !== f.name + "|" + f.content_size))} />
            ))}
        </div>
    )
}

function TextArea({ text, setText, sendMessage }: {
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    sendMessage: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        const textArea = textAreaRef.current
        if (!textArea) return
        textArea.style.height = "auto"
        textArea.style.height = `${textArea.scrollHeight}px`
    }, [text])

    return (
        <div className="flex">
            <textarea
                ref={textAreaRef}
                className="flex-1 px-2 content-center resize-none outline-none"
                placeholder="Type your message here..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={sendMessage}
                autoFocus
            />
        </div>
    )
}

const MAX_FILES = 10
const MAX_FILE_SIZE = 5_000_000