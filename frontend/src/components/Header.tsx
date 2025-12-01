import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useParams } from "react-router"

import { ArchiveButton, DeleteButton, NewChat, ToggleSidebar, UnarchiveButton } from "./Buttons"
import Search from "./Search"
import { useAuth } from "../providers/AuthProvider"
import { useChat } from "../providers/ChatProvider"
import { me } from "../utils/api"

export default function Header() {
    const { chatUUID } = useParams()

    const { user, setUser } = useAuth()
    const { chats, isMobile } = useChat()

    const isSidebarOpen = user ? user.preferences.has_sidebar_open : true

    function setIsSidebarOpen(value: boolean) {
        me(undefined, undefined, value)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: value } } : previous)
    }

    const currentChat = chats.find(c => c.uuid === chatUUID)

    return (
        <header className="flex w-full p-2 items-center justify-between">
            {isMobile &&
                <div className={`flex gap-1 ${isSidebarOpen && "invisible"}`}>
                    <ToggleSidebar withLabel={false} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
                    <NewChat withLabel={false} />
                    <Search openButtonWithLabel={false} />
                </div>
            }

            <p className="text-2xl font-semibold not-md:text-[16px]">Chatbot</p>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger
                    className={`
                        p-2 rounded-lg cursor-pointer outline-none hover:bg-gray-700/50
                        light:hover:bg-gray-300/50 focus:bg-gray-700/50 light:focus:bg-gray-300/50
                        ${!chatUUID && "invisible"}
                    `}
                >
                    <DotsVerticalIcon className="size-4.5" />
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className="flex flex-col mr-2 p-2 rounded-xl shadow-xl/50 border border-gray-500/50 bg-gray-700 light:bg-gray-300">
                        {currentChat && (
                            <>
                                {currentChat.is_archived ? (
                                    <UnarchiveButton chat={currentChat} />
                                ) : (
                                    <ArchiveButton chat={currentChat} />
                                )}
                                <DeleteButton chat={currentChat} />
                            </>
                        )}
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </header>
    )
}