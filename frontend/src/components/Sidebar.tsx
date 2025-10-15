import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@radix-ui/react-icons"
import { useRef, useState } from "react"

import History from "./sidebar/History"
import Search from "./sidebar/Search"
import Settings from "./sidebar/Settings"
import { useAuth } from "../context/AuthProvider"
import { me } from "../utils/api"

export default function Sidebar() {
    const { user } = useAuth()

    const ref = useRef<HTMLDivElement | null>(null)
    const topButtonsRef = useRef<HTMLDivElement | null>(null)
    const settingsButtonRef = useRef<HTMLDivElement | null>(null)

    const [isOpen, setIsOpen] = useState(user ? user.preferences.has_sidebar_open : true)

    const itemClassNames = "flex gap-1 p-2 items-center rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"

    return (
        <div
            ref={ref}
            className={`
                flex flex-col justify-between overflow-x-hidden overflow-y-auto bg-gray-800 light:bg-gray-200
                transition-all duration-300 ${isOpen ? "min-w-[250px] max-w-[250px]" : "min-w-[50px] max-w-[50px]"}
            `}
            style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
        >
            <div ref={topButtonsRef} className={`flex flex-col sticky top-0 gap-1 p-2 bg-gray-800 light:bg-gray-200 ${isOpen && "border-b"}`}>
                <button
                    className={itemClassNames}
                    onClick={_ => {
                        me(undefined, !isOpen)
                        setIsOpen(!isOpen)
                    }}
                    data-testid="toggle-sidebar"
                >
                    {isOpen ? (
                        <><ChevronLeftIcon className="size-5" /> Close Sidebar</>
                    ) : (
                        <ChevronRightIcon className="size-5" />
                    )}
                </button>

                <a className={itemClassNames} href="/" data-testid="new-chat">
                    <PlusIcon className="size-5" /> {isOpen && "New Chat"}
                </a>

                <Search isSidebarOpen={isOpen} itemClassNames={itemClassNames} />
            </div>

            {isOpen && <History sidebarRef={ref} topButtonsRef={topButtonsRef} settingsButtonRef={settingsButtonRef} />}

            <div ref={settingsButtonRef} className={`flex flex-col sticky bottom-0 p-2 bg-gray-800 light:bg-gray-200 ${isOpen && "border-t"}`}>
                <Settings isSidebarOpen={isOpen} itemClassNames={itemClassNames} />
            </div>
        </div>
    )
}