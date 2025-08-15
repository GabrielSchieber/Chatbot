import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import "./ChatPage.css"
import { ConfirmPopup } from "../components/ConfirmPopup"
import type { Chat, SearchEntry } from "../types"

import Settings from "../components/ChatPage/Settings"
import Search from "../components/ChatPage/Search"
import Sidebar from "../components/ChatPage/Sidebar"
import ChatPanel from "../components/ChatPage/Chat"

export default function ChatPage() {
    const { chatUUID } = useParams()

    const [chats, setChats] = useState<Chat[]>([])

    const [isSearchVisible, setIsSearchVisible] = useState(false)
    const [isHidingPopup, setIsHidingPopup] = useState(false)

    const [searchResults, setSearchResults] = useState<SearchEntry[]>([])

    const popupRef = useRef<HTMLDivElement | null>(null)
    const [confirmPopup, setConfirmPopup] = useState<{
        message: string,
        onConfirm: () => void,
        onCancel?: () => void
    } | null>(null)

    function closePopup() {
        setIsHidingPopup(true)
        setTimeout(() => {
            setIsHidingPopup(false)
            setConfirmPopup(null)
        }, 300)
    }

    useEffect(() => {
        if (!confirmPopup) return

        function closePopupOnOutsideClick(event: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                closePopup()
            }
        }

        document.addEventListener("mousedown", closePopupOnOutsideClick)
        return () => document.removeEventListener("mousedown", closePopupOnOutsideClick)
    }, [confirmPopup])

    useEffect(() => {
        if (!confirmPopup) return

        function closePopupOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closePopup()
            }
        }

        document.addEventListener("keydown", closePopupOnEscape)
        return () => document.removeEventListener("keydown", closePopupOnEscape)
    }, [confirmPopup])

    return (
        <>
            <Settings popup={popupRef} confirmPopup={confirmPopup} setConfirmPopup={setConfirmPopup} closePopup={closePopup} />

            <Search
                chats={chats}
                isVisible={isSearchVisible}
                results={searchResults}
                setResults={setSearchResults}
                setIsVisible={setIsSearchVisible}
            />

            <Sidebar
                chatUUID={chatUUID}
                chats={chats}
                setChats={setChats}
                setConfirmPopup={setConfirmPopup}
                closePopup={closePopup}
                setSearchResults={setSearchResults}
                setIsSearchVisible={setIsSearchVisible}
            />

            <ChatPanel chatUUID={chatUUID} chats={chats} setChats={setChats} />

            {confirmPopup &&
                <ConfirmPopup
                    message={confirmPopup.message}
                    isHiding={isHidingPopup}
                    ref={popupRef}
                    onConfirm={confirmPopup.onConfirm}
                    onCancel={confirmPopup.onCancel}
                />
            }
        </>
    )
}