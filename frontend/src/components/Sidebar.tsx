import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons"
import { useState } from "react"

import History from "./sidebar/History"
import Search from "./sidebar/Search"
import Settings from "./sidebar/Settings"
import { useAuth } from "../context/AuthProvider"
import { me } from "../utils/api"

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
                        me(undefined, !isSidebarOpen)
                        setIsSidebarOpen(!isSidebarOpen)
                    }}
                >
                    {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    {isSidebarOpen && <span>Toggle Sidebar</span>}
                </button>
                <a className={itemClassNames} href="/">
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
                divide-y-1 divide-gray-700 transition-all duration-300 ${isSidebarOpen ? "min-w-[250px] max-w-[250px]" : "min-w-[50px] max-w-[50px]"}
            `}
        >
            <TopButtons />
            {isSidebarOpen && <History />}
            <Settings isSidebarOpen={isSidebarOpen} />
        </div>
    )
}