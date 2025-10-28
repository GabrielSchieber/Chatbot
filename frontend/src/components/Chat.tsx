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
            {!chatUUID &&
                <h2 className="mb-5 text-center text-3xl font-semibold truncate">
                    How can I help you today?
                </h2>
            }
            <Prompt />
        </div>
    )
}