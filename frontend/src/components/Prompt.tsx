import { useState } from "react"
import { useNavigate, useParams } from "react-router"

import { newMessage } from "../utils/api"
import type { Message, MessageFile } from "../types"

export default function Prompt({ setMessages }: { setMessages: React.Dispatch<React.SetStateAction<Message[]>> }) {
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