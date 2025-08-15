import { useEffect, useRef, useState } from "react"
import type { Chat, SearchEntry } from "../../types"
import { PastChatDropdownDiv } from "../Dropdown"
import "./Sidebar.css"
import { deleteChat, renameChat, searchChats } from "../../utils/api"

interface SidebarProps {
    chatUUID: string | undefined
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    setConfirmPopup: React.Dispatch<React.SetStateAction<{
        message: string;
        onConfirm: () => void;
        onCancel?: () => void;
    } | null>>
    closePopup: () => void
    setSearchResults: React.Dispatch<React.SetStateAction<SearchEntry[]>>
    setIsSearchVisible: React.Dispatch<React.SetStateAction<boolean>>
}

export default function Sidebar({
    chatUUID,
    chats,
    setChats,
    setConfirmPopup,
    closePopup,
    setSearchResults,
    setIsSearchVisible
}: SidebarProps) {
    const ref = useRef<HTMLDivElement | null>(null)

    const [isVisible, setIsVisible] = useState(() => {
        const stored = localStorage.getItem("isVisible")
        return stored === null ? true : stored === "true"
    })
    const [openDropdownUUID, setOpenDropdownUUID] = useState<string | null>(null)
    const [renamingUUID, setRenamingUUID] = useState<string | null>(null)
    const [renamingTitle, setRenamingTitle] = useState<string>("")

    useEffect(() => localStorage.setItem("isSidebarVisible", String(isVisible)), [isVisible])

    useEffect(() => {
        if (!isVisible) return

        function handleClickOutsideSidebar(event: MouseEvent) {
            if (document.body.clientWidth >= 700) return
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsVisible(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutsideSidebar)
        return () => document.removeEventListener("mousedown", handleClickOutsideSidebar)
    }, [isVisible])

    useEffect(() => {
        const closeDropdownOnOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest(".past-chat-div")) {
                setOpenDropdownUUID(null)
            }
        }
        document.addEventListener("click", closeDropdownOnOutsideClick)
        return () => document.removeEventListener("click", closeDropdownOnOutsideClick)
    }, [])

    function handleRenameChatButton(chat: Chat) {
        setRenamingUUID(chat.uuid)
        setRenamingTitle(chat.title)
        setOpenDropdownUUID(null)
    }

    function handleDeleteChatButton(chat: Chat) {
        setConfirmPopup({
            message: `Are you sure you want to delete ${chat.title}?`,
            onConfirm: () => {
                deleteChat(chat.uuid).then(status => {
                    if (status === 200) {
                        setChats(previous => previous.filter(c => c.uuid !== chat.uuid))
                        if (location.pathname.includes(chat.uuid)) {
                            location.href = "/"
                        }
                        closePopup()
                    } else {
                        setConfirmPopup({
                            message: "Deletion of chat was not possible",
                            onConfirm: () => setConfirmPopup(null)
                        })
                    }
                })
            },
            onCancel: () => closePopup()
        })
        setOpenDropdownUUID(null)
    }

    function handleRenameInput(event: React.KeyboardEvent, chat: Chat) {
        if (event.key === "Enter" && renamingTitle.trim()) {
            renameChat(chat.uuid, renamingTitle.trim()).then(status => {
                if (status !== 200) {
                    alert("Renaming of chat was not possible")
                }
            })
            setChats(previous =>
                previous.map(previous_chat =>
                    previous_chat.uuid === chat.uuid ? { ...previous_chat, title: renamingTitle.trim() } : previous_chat
                )
            )
            setRenamingUUID(null)
        } else if (event.key === "Escape") {
            setRenamingUUID(null)
        }
    }

    function handleSearchChatsButton() {
        setIsSearchVisible(true)
        searchChats("").then(chats => chats && setSearchResults(chats))
        setTimeout(() => document.getElementById("search-input")?.focus(), 300)
    }

    return (
        <>
            {document.body.clientWidth < 700 && isVisible && <div id="sidebar-backdrop-div" onClick={_ => setIsVisible(false)}></div>}

            <div id="sidebar-div" className={isVisible ? "visible" : "invisible"} ref={ref}>
                <div id="buttons-div">
                    <button id="toggle-sidebar-button" onClick={_ => setIsVisible(previous => !previous)}>
                        <span className="buttons-icon-span">≡</span>
                        <span className="buttons-text-span">Close sidebar</span>
                    </button>
                    <button id="open-search-button" onClick={handleSearchChatsButton}>
                        <span className="buttons-icon-span">🔍</span>
                        <span className="buttons-text-span">Search chats</span>
                    </button>
                    <a id="new-chat-a" href="/">
                        <span className="buttons-icon-span">✏</span>
                        <span className="buttons-text-span">New Chat</span>
                    </a>
                </div>
                <div id="history-div">
                    {chats.map((chat, index) => (
                        <div key={chat.uuid} className={`past-chat-div${chat.uuid === chatUUID ? " selected" : ""}${openDropdownUUID === chat.uuid ? " dropdown-open" : ""}`}>
                            {renamingUUID === chat.uuid ? (
                                <input className="past-chat-rename-input" type="text" value={renamingTitle} onChange={event => setRenamingTitle(event.target.value)} onKeyDown={event => { handleRenameInput(event, chat) }} autoFocus />
                            ) : (
                                <>
                                    <a className="past-chat-a" href={`/chat/${chat.uuid}`}>{chat.title}</a>
                                    <button className="past-chat-dropdown-button" onClick={_ => setOpenDropdownUUID(previous => (previous === chat.uuid ? null : chat.uuid))}>≡</button>
                                </>
                            )}
                            {openDropdownUUID === chat.uuid && (
                                <PastChatDropdownDiv index={index}>
                                    <button className="past-chat-rename-button" onClick={_ => handleRenameChatButton(chat)}>Rename</button>
                                    <button className="past-chat-delete-button" onClick={_ => handleDeleteChatButton(chat)}>Delete</button>
                                </PastChatDropdownDiv>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}