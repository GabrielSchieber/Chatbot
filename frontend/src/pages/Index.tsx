import Chat from "../components/index/Chat"
import Sidebar from "../components/index/Sidebar"
import { ChatProvider } from "../providers/ChatProvider"

export default function Index() {
    return (
        <div className="flex w-screen h-screen overflow-hidden text-zinc-100 bg-zinc-900 light:text-zinc-900 light:bg-zinc-100">
            <ChatProvider>
                <Sidebar />
                <Chat />
            </ChatProvider>
        </div>
    )
}