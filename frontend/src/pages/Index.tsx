import Chat from "../components/index/Chat"
import Sidebar from "../components/index/Sidebar"
import { ChatProvider } from "../providers/ChatProvider"

export default function Index() {
    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-gray-900 light:text-black light:bg-gray-100">
            <ChatProvider>
                <Sidebar />
                <Chat />
            </ChatProvider>
        </div>
    )
}