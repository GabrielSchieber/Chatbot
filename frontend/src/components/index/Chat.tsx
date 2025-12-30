import { useRef } from "react"

import Header from "./chat/Header"
import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"
import Introduction from "./chat/Introduction"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    const ref = useRef<HTMLDivElement | null>(null)
    const hasSentMessage = useRef(false)

    return (
        <div className="relative flex flex-col size-full items-center overflow-y-auto">
            <Header />
            <Messages chatRef={ref} hasSentMessage={hasSentMessage} />
            <Introduction />
            <Prompt hasSentMessage={hasSentMessage} />
        </div>
    )
}