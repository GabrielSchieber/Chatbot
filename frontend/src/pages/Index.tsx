import { useState } from "react"

import Chat from "../components/Chat"
import Sidebar from "../components/Sidebar"
import { type Chat as ChatType } from "../types"

export default function Index() {
    const [chats, setChats] = useState<ChatType[]>([])

    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-gray-900 light:text-black light:bg-gray-100">
            <Sidebar chats={chats} setChats={setChats} />
            <Chat setChats={setChats} />
        </div>
    )
}