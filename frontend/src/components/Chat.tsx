import Messages from "./chat/Messages"
import Prompt from "./chat/Prompt"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    return (
        <div className="flex flex-col size-full items-center">
            <Messages />
            <Prompt />
        </div>
    )
}