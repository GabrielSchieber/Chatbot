import { Cross1Icon, FileIcon } from "@radix-ui/react-icons"
import { useState } from "react"

import Messages from "./Messages"
import Prompt from "./Prompt"
import { getFileSize, getFileType } from "../utils/file"
import type { Message, MessageFile } from "../types"

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([])

    return (
        <div className="flex flex-col size-full items-center">
            <Messages messages={messages} setMessages={setMessages} />
            <Prompt setMessages={setMessages} />
        </div>
    )
}

export function Attachment({ file, onRemove }: { file: MessageFile, onRemove?: () => void }) {
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
            {onRemove &&
                <button className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={onRemove}>
                    <Cross1Icon className="size-3.5" />
                </button>
            }
        </div>
    )
}