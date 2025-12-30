import { motion } from "motion/react"
import { useRef } from "react"

import Header from "./chat/Header"
import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"
import Introduction from "./chat/Introduction"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    const ref = useRef<HTMLDivElement | null>(null)

    return (
        <div ref={ref} className="flex flex-col size-full min-w-0 items-center overflow-y-auto">
            <Header />
            <motion.div className="relative flex flex-col size-full items-center">
                <Messages chatRef={ref} />
                <Introduction />
                <Prompt />
            </motion.div>
        </div>
    )
}