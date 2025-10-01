import { ArrowUpIcon, BoxModelIcon, CheckIcon, PlusIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router"

import { newMessage } from "../utils/api"
import type { Message, MessageFile, Model } from "../types"

export default function Prompt({ setMessages }: { setMessages: React.Dispatch<React.SetStateAction<Message[]>> }) {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

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

                requestAnimationFrame(_ => {
                    const messages = document.getElementById("messages")
                    if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: "auto" })
                })

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
        <div className="flex w-[60vw] mt-auto mb-5 px-5 rounded-3xl bg-gray-700 light:bg-gray-300">
            <div className="flex gap-2">
                <Button icon={<PlusIcon className="size-6" />} />
                <Dropdown icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
            </div>
            <div className="flex flex-1 flex-col">
                <Attachments files={files.map((f, i) => ({ id: i, name: f.name, content_size: f.size, content_type: f.type }))} />
                <TextArea text={text} setText={setText} sendMessage={sendMessageWithEvent} />
            </div>
            <Button icon={<ArrowUpIcon className="size-6" />} />
        </div>
    )
}

function Button({ icon }: { icon: ReactNode }) {
    return <button>{icon}</button>
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
            <DropdownMenu.Trigger>{icon}</DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-1 rounded-md bg-gray-800 light:bg-gray-200">
                {models.map(m => (
                    <Item key={m} m={m} />
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
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
            className="px-3 py-1 content-center rounded-3xl resize-none outline-none bg-gray-700 light:bg-gray-300"
            placeholder="Type your message here..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={sendMessage}
            autoFocus
        />
    )
}