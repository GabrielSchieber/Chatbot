import { ChevronDownIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useParams } from "react-router"

import { ArchiveButton, DeleteButton, NewChat, RenameDialog, ToggleSidebar, UnarchiveButton } from "./Buttons"
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

            {currentChat ? (
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                        className={`
                            flex max-w-full gap-1 px-2 py-1 items-center cursor-pointer rounded-lg
                            outline-none overflow-hidden hover:bg-gray-600/50 light:hover:bg-gray-400/50
                            ${!isMobile && "mx-auto"}
                        `}
                    >
                        <p className="flex-1 min-w-0 truncate">
                            {currentChat.title}
                        </p>

                        <ChevronDownIcon className="size-5 flex-shrink-0" />
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="flex flex-col gap-1 p-2 rounded-xl shadow-xl/50 border border-gray-500/50 bg-gray-700 light:bg-gray-300"
                            sideOffset={10}
                        >
                            <RenameDialog />
                            {currentChat.is_archived ? (
                                <UnarchiveButton chat={currentChat} />
                            ) : (
                                <ArchiveButton chat={currentChat} />
                            )}
                            <DeleteButton chat={currentChat} />
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            ) : (
                <p className="mx-auto text-2xl font-semibold not-md:text-[16px]">Chatbot</p>
            )}
        </header>
    )
}