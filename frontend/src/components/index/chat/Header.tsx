import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router"

import { ArchiveButton, DeleteButton, NewChat, RenameDialog, TemporaryChat, ToggleSidebar, UnarchiveButton } from "../../misc/Buttons"
import Search from "../sidebar/Search"
import { useAuth } from "../../../providers/AuthProvider"
import { useChat } from "../../../providers/ChatProvider"
import { me } from "../../../utils/api"

export default function Header() {
    const { chatUUID } = useParams()
    const { t } = useTranslation()

    const { user, setUser } = useAuth()
    const { chats, isMobile, isTemporaryChat } = useChat()

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [screenWidth, setScreenWidth] = useState(window.innerWidth)

    const isSidebarOpen = user ? user.preferences.has_sidebar_open : true
    const currentChat = chats.find(c => c.uuid === chatUUID)

    function setIsSidebarOpen(value: boolean) {
        me(undefined, undefined, value)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: value } } : previous)
    }

    useEffect(() => {
        const onResize = () => setScreenWidth(window.innerWidth)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    if (!user) return

    return (
        <header className="sticky top-0 flex w-full gap-1 p-2 items-center justify-between">
            {isMobile &&
                <div className={`flex gap-1 px-1.5 py-0.5 rounded-lg border border-zinc-500 bg-zinc-900 light:bg-zinc-100 ${isSidebarOpen && "invisible"}`}>
                    <ToggleSidebar withLabel={false} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
                    <NewChat withLabel={false} />
                    <Search openButtonWithLabel={false} />
                    {(isTemporaryChat || !currentChat) && <TemporaryChat withLabel={false} />}
                </div>
            }

            {!isTemporaryChat && currentChat ? (
                <DropdownMenu.Root onOpenChange={o => setIsDropdownOpen(o)}>
                    <DropdownMenu.Trigger
                        className={`
                            flex max-w-full gap-1 px-2 py-2 items-center cursor-pointer
                            rounded-lg outline-none overflow-hidden border border-zinc-500
                            bg-zinc-900 hover:bg-zinc-800 light:bg-zinc-100 light:hover:bg-zinc-200
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
                            className="flex flex-col mx-2 p-2 rounded-xl shadow-xl/50 border border-zinc-700 bg-zinc-900 light:bg-zinc-100"
                            sideOffset={3}
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
                    <p
                        className={`
                            text-2xl font-semibold not-md:mx-auto
                            ${((!user.is_guest && screenWidth < 300) || (user.is_guest && screenWidth < 500)) ? "hidden" : ""}
                        `}
                    >
                        Chatbot
                    </p>

                    {user.is_guest ? (
                        <div className="flex gap-2 items-center">
                            {!isMobile && <TemporaryChat withLabel={true} />}

                            <a
                                className="
                                    px-3 py-2 rounded-full cursor-pointer
                                    text-black light:text-white
                                    bg-zinc-100 light:bg-zinc-800
                                    hover:bg-zinc-200 light:hover:bg-zinc-700
                                "
                                href="/login"
                            >
                                {t("login.logIn")}
                            </a>

                            {screenWidth > 375 &&
                                <a
                                    className="
                                        px-3 py-1.5 rounded-full cursor-pointer
                                        hover:bg-zinc-700 light:hover:bg-zinc-300
                                        border border-zinc-500
                                    "
                                    href="/signup"
                                >
                                    {t("signup.signUp")}
                                </a>
                            }
                        </div>
                    ) : screenWidth > 525 && (
                        <TemporaryChat withLabel={true} />
                    )}
                </>
            )}
        </header>
    )
}