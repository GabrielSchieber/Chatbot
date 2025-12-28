import { t } from "i18next"
import { useRef } from "react"
import { useParams } from "react-router"

import Header from "./chat/Header"
import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"
import { useChat } from "../../providers/ChatProvider"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    const { chatUUID } = useParams()

    const { isMobile } = useChat()

    const ref = useRef<HTMLDivElement | null>(null)

    return (
        <div ref={ref} className="flex flex-col size-full min-w-0 items-center overflow-y-auto">
            <Header />
            <Messages chatRef={ref} />
            <h1
                className={`
                    text-3xl font-semibold text-center transition-opacity duration-300
                    ${chatUUID ?
                        "fixed mt-25 top-0 bottom-0 translate-y-[25%] opacity-0 pointer-events-none" :
                        `mb-5 opacity-100 pointer-events-auto ${isMobile && "mt-auto"}
                    `}
                `}
            >
                {t("chat.header")}
            </h1>
            <Prompt />
        </div>
    )
}