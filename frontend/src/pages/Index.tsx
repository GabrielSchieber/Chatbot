import Chat from "../components/Chat"
import { Sidebar } from "../components/Sidebar"

export default function Index() {
    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-gray-900 light:text-black light:bg-gray-100">
            <Sidebar />
            <Chat />
        </div>
    )
}