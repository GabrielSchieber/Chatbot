import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons"
import { useEffect, useRef, useState } from "react"

import History from "./History"
import Search from "./Search"
import Settings from "./Settings"
import { getChats } from "../utils/api"
import type { Chat } from "../types"
import { setCurrentUser } from "../utils/auth"
import { useAuth } from "../context/AuthProvider"

export default function Sidebar() {
    const { user } = useAuth()

    const [chats, setChats] = useState<Chat[]>([])
    const [isSidebarOpen, setIsSidebarOpen] = useState(user ? user.has_sidebar_open : true)
    const shouldLoadChats = useRef(true)

    function TopButtons() {
        const itemClassNames = `
            flex items-center gap-2 p-2 rounded outline-none cursor-pointer
            hover:bg-gray-700 light:hover:bg-gray-300 focus:bg-gray-700 light:focus:bg-gray-300
        `

        return (
            <div className={`flex flex-col gap-2 p-2 ${!isSidebarOpen && "items-center"}`}>
                <button className={itemClassNames} onClick={_ => {
                    setCurrentUser(undefined, !isSidebarOpen)
                    setIsSidebarOpen(!isSidebarOpen)
                }}>
                    {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    {isSidebarOpen && <span>Toggle Sidebar</span>}
                </button>
                <a className={itemClassNames} href="/">
                    <PlusIcon />
                    {isSidebarOpen && <span>New Chat</span>}
                </a>
                <Search isSidebarOpen={isSidebarOpen} chats={chats} />
            </div>
        )
    }

    function loadChats() {
        if (shouldLoadChats.current) {
            shouldLoadChats.current = false
            getChats().then(response => setChats(response.chats))
        }
    }

    useEffect(() => loadChats(), [])

    return (
        <div className={`
            flex flex-col bg-gray-800 light:bg-gray-200 justify-between
            divide-y-1 divide-gray-700 transition-all duration-300 ${isSidebarOpen ? "w-[250px]" : "w-[50px]"}
        `}>
            <TopButtons />
            {isSidebarOpen && <History chats={chats} setChats={setChats} />}
            <Settings isSidebarOpen={isSidebarOpen} />
        </div>
    )
}