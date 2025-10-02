import { Pencil1Icon } from "@radix-ui/react-icons"

import { Button, Copy } from "./Buttons"
import Attachments from "../../ui/Attachments"
import { useChat } from "../../../context/ChatProvider"
import type { MessageFile } from "../../../types"

export function User({ text, files, onEditClick }: { text: string, files: MessageFile[], onEditClick: () => void }) {
    return (
        <>
            <div
                className="flex flex-col gap-1 min-w-20 max-w-[80%] px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300"
                style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
            >
                <div className="flex flex-col gap-2 items-start">
                    <Attachments files={files} />
                </div>
                <div className="w-full whitespace-pre-wrap">
                    {text}
                </div>
            </div>

            <div className="flex gap-1">
                <Edit onClick={onEditClick} />
                <Copy text={text} />
            </div>
        </>
    )
}

function Edit({ onClick }: { onClick: () => void }) {
    const { pendingChat, isLoading } = useChat()

    return (
        <Button
            trigger={<Pencil1Icon className="size-4.5" />}
            tooltip="Edit"
            onClick={onClick}
            isDisabled={pendingChat !== null || isLoading}
        />
    )
}