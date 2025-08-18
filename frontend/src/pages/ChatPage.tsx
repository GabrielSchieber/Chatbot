import "./ChatPage.css"
import Sidebar from "../components/Sidebar"
import ChatPanel from "../components/Chat"

export default function ChatPage() {
    return (
        <div className="flex h-screen w-screen bg-gray-900 text-white">
            <Sidebar />
            <ChatPanel />
        </div>
    )
}