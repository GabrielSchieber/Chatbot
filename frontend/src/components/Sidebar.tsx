import { ChevronLeftIcon, ChevronRightIcon, GearIcon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons"
import { useRef, useState } from "react"

import History from "./sidebar/History"

export default function Sidebar() {
    const ref = useRef<HTMLDivElement | null>(null)
    const topButtonsRef = useRef<HTMLDivElement | null>(null)
    const settingsButtonRef = useRef<HTMLDivElement | null>(null)

    const [isOpen, setIsOpen] = useState(true)

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
            <div ref={topButtonsRef} className="flex flex-col sticky top-0 gap-1 p-2 border-b bg-gray-800 light:bg-gray-200">
                <button className={itemClassNames} onClick={_ => setIsOpen(!isOpen)}>
                    {isOpen ? (
                        <><ChevronLeftIcon className="size-5" /> Close Sidebar</>
                    ) : (
                        <ChevronRightIcon className="size-5" />
                    )}
                </button>

                <a className={itemClassNames} href="/">
                    <PlusIcon className="size-5" /> {isOpen && "New Chat"}
                </a>

                <button className={itemClassNames}>
                    <MagnifyingGlassIcon className="size-5" /> {isOpen && "Search Chats"}
                </button>
            </div>

            {isOpen && <History sidebarRef={ref} topButtonsRef={topButtonsRef} settingsButtonRef={settingsButtonRef} />}

            <div ref={settingsButtonRef} className="flex flex-col sticky bottom-0 p-2 border-t bg-gray-800 light:bg-gray-200">
                <button className={itemClassNames}>
                    <GearIcon className="size-5" /> {isOpen && "Settings"}
                </button>
            </div>
        </div>
    )
}