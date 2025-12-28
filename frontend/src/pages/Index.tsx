import Chat from "../components/index/Chat"
import GuestChat from "../components/index/GuestChat"
import Sidebar from "../components/index/Sidebar"
import { useAuth } from "../providers/AuthProvider"
import { ChatProvider } from "../providers/ChatProvider"

export default function Index() {
    const { isLoggedIn } = useAuth()

    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-gray-900 light:text-black light:bg-gray-100">
            {isLoggedIn ? (
                <ChatProvider>
                    <Sidebar />
                    <Chat />
                </ChatProvider>
            ) : (
                <GuestChat />
            )}
        </div>
    )
}