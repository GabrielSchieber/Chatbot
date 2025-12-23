import Chat from "../components/Chat"
import GuestChat from "../components/GuestChat"
import Sidebar from "../components/Sidebar"
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