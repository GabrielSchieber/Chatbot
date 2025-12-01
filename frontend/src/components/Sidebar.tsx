import { useRef } from "react"

import { NewChat, ToggleSidebar } from "./Buttons"
import History from "./History"
import Search from "./Search"
import Settings from "./Settings"
import { useAuth } from "../providers/AuthProvider"
import { useChat } from "../providers/ChatProvider"
import { me } from "../utils/api"

export default function Sidebar() {
    const { user, setUser } = useAuth()
    const { isMobile } = useChat()

    const ref = useRef<HTMLDivElement | null>(null)

    const isOpen = user ? user.preferences.has_sidebar_open : true

    function setIsOpen(value: boolean) {
        me(undefined, undefined, value)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: value } } : previous)
    }

    return (
        <>
            <div
                className={`fixed inset-0 duration-500 ${isMobile && isOpen ? "bg-black/50" : "pointer-events-none"}`}
                onClick={_ => setIsOpen(false)}
            />

            <div
                ref={ref}
                className={`
                    flex flex-col justify-between overflow-x-hidden overflow-y-auto duration-300 ease-in-out bg-gray-800 light:bg-gray-200
                    ${isOpen ? "min-w-[250px] max-w-[250px]" : isMobile ? "min-w-0 max-w-0" : "min-w-[50px] max-w-[50px]"}
                    ${isMobile && "fixed inset-0"}
                `}
            >
                <div className={`sticky flex flex-col top-0 gap-1 p-2 bg-gray-800 light:bg-gray-200 ${isOpen && "border-b"}`}>
                    <ToggleSidebar withLabel={isOpen} onClick={() => setIsOpen(!isOpen)} />
                    <NewChat withLabel={isOpen} />
                    <Search openButtonWithLabel={isOpen} />
                </div>

                <History isSidebarOpen={isOpen} sidebarRef={ref} />

                <div className={`sticky flex flex-col bottom-0 p-2 bg-gray-800 light:bg-gray-200 ${isOpen && "border-t"}`}>
                    <Settings isSidebarOpen={isOpen} />
                </div>
            </div>
        </>
    )
}