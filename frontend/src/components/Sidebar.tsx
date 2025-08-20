import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons";
import Search from "./Search";
import Settings from "./Settings";
import History from "./History";
import type { Chat } from "../types";
import { getChats } from "../utils/api";
import { useEffect, useRef, useState } from "react";

export default function Sidebar() {
    const [chats, setChats] = useState<Chat[]>([])
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const shouldLoadChats = useRef(true)

    function loadChats() {
        if (shouldLoadChats.current) {
            shouldLoadChats.current = false
            getChats().then(setChats)
        }
    }

    useEffect(() => loadChats(), [])

    return (
        <div className={`flex flex-col p-2 bg-gray-800 light:bg-gray-200 transition-all duration-300 justify-between ${isSidebarOpen ? "w-[250px]" : "w-[50px]"}`}>
            <div className={`flex flex-col gap-2 pb-2 border-b border-gray-700 ${!isSidebarOpen && "items-center"}`}>
                <button
                    className="flex items-center gap-2 p-2 rounded outline-none hover:bg-gray-700 light:hover:bg-gray-300"
                    onClick={_ => setIsSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    {isSidebarOpen && <span>Toggle Sidebar</span>}
                </button>

                <a
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 light:hover:bg-gray-300"
                    href="/"
                >
                    <PlusIcon />
                    {isSidebarOpen && <span>New Chat</span>}
                </a>

                <Search isSidebarOpen={isSidebarOpen} chats={chats} />
            </div>

            {isSidebarOpen && <History chats={chats} setChats={setChats} />}

            <Settings isSidebarOpen={isSidebarOpen} />
        </div>
    )
}