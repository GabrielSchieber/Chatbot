import { ChatBubbleIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useState } from "react"
import { useParams } from "react-router"

import { ArchiveButton, DeleteButton, NewChat, RenameDialog, ToggleSidebar, UnarchiveButton } from "./Buttons"
import Search from "./Search"
import { useAuth } from "../providers/AuthProvider"
import { useChat } from "../providers/ChatProvider"
import { me } from "../utils/api"

export default function Header() {
    const { chatUUID } = useParams()

    const { user, setUser } = useAuth()
    const { chats, isMobile, isTemporaryChat, setIsTemporaryChat } = useChat()

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    const isSidebarOpen = user ? user.preferences.has_sidebar_open : true

    function setIsSidebarOpen(value: boolean) {
        me(undefined, undefined, value)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: value } } : previous)
    }

    const currentChat = chats.find(c => c.uuid === chatUUID)

    return (
        <header className="sticky top-0 flex w-full gap-1 p-2 items-center justify-between">
            {isMobile &&
                <div className={`flex gap-1 px-1.5 py-0.5 rounded-lg bg-gray-800 light:bg-gray-200 ${isSidebarOpen && "invisible"}`}>
                    <ToggleSidebar withLabel={false} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
                    <NewChat withLabel={false} />
                    <Search openButtonWithLabel={false} />
                </div>
            }

            {!isTemporaryChat && currentChat ? (
                <DropdownMenu.Root onOpenChange={o => setIsDropdownOpen(o)}>
                    <DropdownMenu.Trigger
                        className={`
                            flex max-w-full gap-1 px-2 py-2 items-center cursor-pointer rounded-lg outline-none overflow-hidden
                            bg-gray-800 hover:bg-gray-700 light:bg-gray-100 light:hover:bg-gray-200
                            ${!isMobile && "mx-auto"}
                        `}
                    >
                        <p className="flex-1 min-w-0 truncate">
                            {currentChat.title}
                        </p>

                        {isDropdownOpen ?
                            <ChevronUpIcon className="size-5 flex-shrink-0" /> :
                            <ChevronDownIcon className="size-5 flex-shrink-0" />
                        }
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className="flex flex-col p-2 rounded-xl shadow-xl/50 border border-gray-500 bg-gray-800 light:bg-gray-200"
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
                <>
                    <p className="text-2xl font-semibold not-md:text-[16px]">Chatbot</p>
                    <button
                        className={`
                            flex gap-1 p-2 items-center rounded not-disabled:cursor-pointer
                            not-md:text-[14px] border border-transparent disabled:border-blue-500
                            ${isTemporaryChat
                                ? "bg-blue-500/50 not-disabled:hover:bg-blue-500/30"
                                : "bg-gray-800 hover:bg-gray-700 light:bg-gray-200 light:hover:bg-gray-300"
                            }
                        `}
                        onClick={() => {
                            if (chatUUID !== undefined && isTemporaryChat) return
                            setIsTemporaryChat(!isTemporaryChat)
                        }}
                        disabled={chatUUID !== undefined && isTemporaryChat}
                    >
                        <ChatBubbleIcon />
                        Temporary
                    </button>
                </>
            )}
        </header>
    )
}