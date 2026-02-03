import { useRef } from "react"

import Header from "./chat/Header"
import Introduction from "./chat/Introduction"
import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    const ref = useRef<HTMLDivElement | null>(null)
    const hasSentMessage = useRef(false)
    const introductionRef = useRef<HTMLHeadingElement | null>(null)

    return (
        <div ref={ref} className="relative flex flex-col flex-1 h-full min-w-0 items-center overflow-x-hidden overflow-y-auto">
            <Header />
            <Messages chatRef={ref} hasSentMessage={hasSentMessage} introductionRef={introductionRef} />
            <Introduction ref={introductionRef} />
            <Prompt hasSentMessage={hasSentMessage} />
        </div>
    )
}