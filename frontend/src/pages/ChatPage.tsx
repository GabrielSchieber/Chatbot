import Sidebar from "../components/Sidebar"
import ChatPanel from "../components/Chat"

export default function ChatPage() {
    return (
        <div className="flex w-screen h-screen text-white bg-gray-900 light:text-black light:bg-gray-100">
            <Sidebar />
            <ChatPanel />
        </div>
    )
}