import { useParams } from "react-router"

import Header from "./chat/Header"
import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    const { chatUUID } = useParams()

    return (
        <div className="flex flex-col size-full items-center">
            <Header />
            <Messages />
            <h1
                className={`
                    text-3xl font-semibold truncate transition-opacity duration-300
                    ${chatUUID ? "fixed mt-25 top-0 bottom-0 translate-y-[35%] opacity-0 pointer-events-none" : "mb-5"}
                `}
            >
                How can I help you today?
            </h1>
            <Prompt />
        </div>
    )
}