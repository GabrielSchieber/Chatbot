import { useRef } from "react"

import History from "./sidebar/History"
import Search from "./sidebar/Search"
import Settings from "./sidebar/Settings"
import { NewChat, ToggleSidebar } from "../misc/Buttons"
import { useAuth } from "../../providers/AuthProvider"
import { useChat } from "../../providers/ChatProvider"
import { me } from "../../utils/api"

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
                className={`z-10 fixed inset-0 duration-500 ${isMobile && isOpen ? "bg-black/50" : "pointer-events-none"}`}
                onClick={_ => setIsOpen(false)}
            />

            <div
                ref={ref}
                className={`
                    z-10 flex flex-col justify-between overflow-x-hidden overflow-y-auto 
                    bg-zinc-950 light:bg-zinc-50 border-r border-zinc-800 light:border-zinc-200
                    duration-300 ease-in-out
                    ${isOpen ? "min-w-[250px] max-w-[250px]" : isMobile ? "min-w-0 max-w-0" : "min-w-[50px] max-w-[50px]"}
                    ${isMobile && "fixed inset-0"}
                `}
            >
                <div
                    className={`
                        sticky flex flex-col top-0 gap-1 p-2 bg-zinc-950 light:bg-zinc-50
                        ${isOpen ? "border-b border-zinc-800 light:border-zinc-200" : "items-center"}
                    `}
                >
                    <ToggleSidebar withLabel={isOpen} onClick={() => setIsOpen(!isOpen)} />
                    <NewChat withLabel={isOpen} />
                    <Search openButtonWithLabel={isOpen} />
                </div>

                <History isSidebarOpen={isOpen} sidebarRef={ref} />

                <div
                    className={`
                        sticky flex flex-col bottom-0 p-2 bg-zinc-950 light:bg-zinc-50
                        ${isOpen ? "border-t border-zinc-800 light:border-zinc-200" : "items-center"}
                    `}
                >
                    <Settings isSidebarOpen={isOpen} />
                </div>
            </div>
        </>
    )
}