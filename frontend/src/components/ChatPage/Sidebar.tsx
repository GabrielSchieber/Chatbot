import type { Chat } from "../../types"
import { PastChatDropdownDiv } from "../Dropdown"
import "./Sidebar.css"

interface SidebarProps {
    ref: React.RefObject<HTMLDivElement | null>
    isVisible: boolean
    chats: Chat[]
    chatUUID: string | undefined
    openDropdownUUID: string | null
    renamingTitle: string
    renamingUUID: string | null
    setIsVisible: (value: React.SetStateAction<boolean>) => void
    setOpenDropdownUUID: (value: React.SetStateAction<string | null>) => void
    setRenamingTitle: (value: React.SetStateAction<string>) => void
    handleRenameInput: (event: React.KeyboardEvent<Element>, chat: Chat) => void
    handleSearchChatsButton: () => void
    handleRenameChatButton: (chat: Chat) => void
    handleDeleteChatButton: (chat: Chat) => void
}

export default function Sidebar(
    {
        ref,
        isVisible,
        chats,
        chatUUID,
        openDropdownUUID,
        renamingTitle,
        renamingUUID,
        setIsVisible,
        setOpenDropdownUUID,
        setRenamingTitle,
        handleRenameInput,
        handleSearchChatsButton,
        handleRenameChatButton,
        handleDeleteChatButton,
    }: SidebarProps
) {
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