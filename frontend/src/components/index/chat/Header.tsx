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
import type { Chat } from "../../../utils/types"

export default function Header() {
    const { chatUUID } = useParams()

    const { user } = useAuth()
    const { chats, isMobile, isTemporaryChat } = useChat()

    const [screenWidth, setScreenWidth] = useState(window.innerWidth)

    const currentChat = chats.find(c => c.uuid === chatUUID)

    useEffect(() => {
        const onResize = () => setScreenWidth(window.innerWidth)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    if (!user) return

    return (
        <header className="sticky top-0 flex w-full gap-1 p-2 items-center justify-between">
            {user.is_guest ? (
                currentChat ? (
                    isMobile ? (
                        <>
                            <MobileActionButtons />
                            {!isTemporaryChat && <ChatDropdown chat={currentChat} />}
                        </>
                    ) : (
                        isTemporaryChat ? (
                            <TemporaryChat withLabel={true} />
                        ) : (
                            <ChatDropdown chat={currentChat} />
                        )
                    )
                ) : (
                    isMobile ? (
                        <>
                            <MobileActionButtons />
                            {screenWidth > 500 && <ChatbotParagraph />}
                            <div className="flex gap-2">
                                <LoginAnchor />
                                {screenWidth > 375 && <SignupAnchor />}
                            </div>
                        </>
                    ) : (
                        <>
                            <ChatbotParagraph />
                            <div className="flex gap-2">
                                <TemporaryChat withLabel={true} />
                                <LoginAnchor />
                                {screenWidth > 375 && <SignupAnchor />}
                            </div>
                        </>
                    )
                )
            ) : (
                currentChat ? (
                    isMobile ? (
                        <>
                            <MobileActionButtons />
                            {!isTemporaryChat && <ChatDropdown chat={currentChat} />}
                        </>
                    ) : (
                        isTemporaryChat ? (
                            <TemporaryChat withLabel={true} />
                        ) : (
                            <ChatDropdown chat={currentChat} />
                        )
                    )
                ) : (
                    isMobile ? (
                        <>
                            <MobileActionButtons />
                            {screenWidth > 350 && <ChatbotParagraph mxAuto={true} />}
                        </>
                    ) : (
                        <>
                            <ChatbotParagraph />
                            <TemporaryChat withLabel={true} />
                        </>
                    )
                )
            )}
        </header>
    )
}

function ChatbotParagraph({ mxAuto = false }: { mxAuto?: boolean }) {
    return <p className={`text-2xl font-semibold ${mxAuto ? "mx-auto" : ""}`}>Chatbot</p>
}

function LoginAnchor() {
    const { t } = useTranslation()

    return (
        <a
            className="
                px-3 py-1.5 rounded-full cursor-pointer
                text-black light:text-white
                bg-zinc-100 light:bg-zinc-800
                hover:bg-zinc-200 light:hover:bg-zinc-700
            "
            href="/login"
        >
            {t("login.logIn")}
        </a>
    )
}

function SignupAnchor() {
    const { t } = useTranslation()

    return (
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
    )
}

function ChatDropdown({ chat }: { chat: Chat }) {
    const { isMobile } = useChat()

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    return (
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
                    {chat.title}
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
                    {chat.is_archived ? (
                        <UnarchiveButton chat={chat} />
                    ) : (
                        <ArchiveButton chat={chat} />
                    )}
                    <DeleteButton chat={chat} />
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}

function MobileActionButtons() {
    const { chatUUID } = useParams()

    const { user, setUser } = useAuth()

    const { chats, isTemporaryChat } = useChat()

    function setIsSidebarOpen(value: boolean) {
        me(undefined, undefined, value)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, has_sidebar_open: value } } : previous)
    }

    const currentChat = chats.find(c => c.uuid === chatUUID)
    const isSidebarOpen = user ? user.preferences.has_sidebar_open : true

    return (
        <div
            className={`
                flex gap-1 px-1.5 py-0.5 rounded-lg border border-zinc-500
                bg-zinc-900 light:bg-zinc-100 ${isSidebarOpen && "invisible"}
            `}
        >
            <ToggleSidebar withLabel={false} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <NewChat withLabel={false} />
            <Search openButtonWithLabel={false} />
            {(!currentChat || isTemporaryChat) && <TemporaryChat withLabel={false} />}
        </div>
    )
}