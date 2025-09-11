import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons"
import { useState } from "react"

import History from "./History"
import Search from "./Search"
import Settings from "./Settings"
import { useAuth } from "../context/AuthProvider"
import { setCurrentUser } from "../utils/auth"

export default function Sidebar() {
    const { user } = useAuth()

    const [isSidebarOpen, setIsSidebarOpen] = useState(user ? user.has_sidebar_open : true)

    function TopButtons() {
        const itemClassNames = `
            flex items-center gap-2 p-2 rounded outline-none cursor-pointer
            hover:bg-gray-700 light:hover:bg-gray-300 focus:bg-gray-700 light:focus:bg-gray-300
        `

        return (
            <div className={`flex flex-col gap-2 p-2 ${!isSidebarOpen && "items-center"}`}>
                <button
                    className={itemClassNames} onClick={_ => {
                        setCurrentUser(undefined, !isSidebarOpen)
                        setIsSidebarOpen(!isSidebarOpen)
                    }}
                    data-testid="toggle-sidebar"
                >
                    {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    {isSidebarOpen && <span>Toggle Sidebar</span>}
                </button>
                <a className={itemClassNames} href="/" data-testid="new-chat">
                    <PlusIcon />
                    {isSidebarOpen && <span>New Chat</span>}
                </a>
                <Search isSidebarOpen={isSidebarOpen} />
            </div>
        )
    }

    return (
        <div
            className={`
                flex flex-col bg-gray-800 light:bg-gray-200 justify-between
                divide-y-1 divide-gray-700 transition-all duration-300 ${isSidebarOpen ? "w-[250px]" : "w-[50px]"}
            `}
        >
            <TopButtons />
            {isSidebarOpen && <History />}
            <Settings isSidebarOpen={isSidebarOpen} />
        </div>
    )
}