import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"
import { ChatProvider } from "../context/ChatProvider"
import { type Chat as ChatType } from "../types"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat({ setChats }: { setChats: React.Dispatch<React.SetStateAction<ChatType[]>> }) {
    return (
        <div className="flex flex-col size-full items-center">
            <ChatProvider>
                <Messages />
                <Prompt setChats={setChats} />
            </ChatProvider>
        </div>
    )
}