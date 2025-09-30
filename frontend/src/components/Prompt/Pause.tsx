import { PauseIcon } from "@radix-ui/react-icons"
import type { Chat } from "../../types"

export default function Pause({ stopPendingChats, setPendingChat }: {
    stopPendingChats: () => void
    setPendingChat: React.Dispatch<React.SetStateAction<Chat | undefined>>
}) {
    return (
        <button
            className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end cursor-pointer"
            tabIndex={3}
            onClick={_ => {
                stopPendingChats()
                setPendingChat(undefined)
            }}
        >
            <PauseIcon className="size-6 text-white" />
        </button>
    )
}