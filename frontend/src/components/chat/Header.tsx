import { ChevronRightIcon, DotsVerticalIcon, PlusIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useParams } from "react-router"

import Search from "../sidebar/Search"
import { ArchiveButton, DeleteButton } from "../ui/Buttons"
import { useAuth } from "../../context/AuthProvider"
import { useChat } from "../../context/ChatProvider"
import { me } from "../../utils/api"

export default function Header() {
    const { chatUUID } = useParams()

    const { user, setUser } = useAuth()
    const { chats, isMobile } = useChat()

    const currentChat = chats.find(c => c.uuid === chatUUID)

    const isSidebarOpen = user ? user.preferences.has_sidebar_open : true
    const setIsSidebarOpen = (value: boolean) => setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: value } } : previous)

    const itemClassNames = "flex gap-1 p-2 items-center rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"

    return (
        <header className="flex w-full px-3 py-1 items-center justify-between">
            {isMobile ? (
                !isSidebarOpen && (
                    <div className="flex gap-1">
                        <button
                            className={itemClassNames}
                            onClick={_ => {
                                me(undefined, true)
                                setIsSidebarOpen(true)
                            }}
                            data-testid="toggle-sidebar"
                        >
                            <ChevronRightIcon className="size-5" />
                        </button>

                        <a className={itemClassNames} href="/" data-testid="new-chat">
                            <PlusIcon className="size-5" />
                        </a>

                        <Search itemClassNames={itemClassNames} />
                    </div>
                )
            ) : (
                <p className="text-2xl font-semibold">Chatbot</p>
            )}

            {currentChat &&
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                        className="
                            p-2 rounded-lg cursor-pointer outline-none hover:bg-gray-700/50
                            light:hover:bg-gray-300/50 focus:bg-gray-700/50 light:focus:bg-gray-300/50
                        "
                    >
                        <DotsVerticalIcon className="size-4.5" />
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="flex flex-col mr-2 p-2 rounded-xl shadow-xl/50 border border-gray-500/50 bg-gray-700 light:bg-gray-300">
                            <ArchiveButton chat={currentChat} />
                            <DeleteButton chat={currentChat} />
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            }
        </header>
    )
}