import React, { useCallback } from "react"
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import "./ChatPage.css"
import { logout } from "../utils/auth"
import { useTheme } from "../context/ThemeProvider"
import type { Theme } from "../utils/theme"
import { PastChatDropdownDiv } from "../components/Dropdown"
import { ConfirmPopup } from "../components/ConfirmPopup"
import { throttle } from "../utils/throttle"
import { deleteAccount, deleteChat, deleteChats, getChats, getMessage, getMessages, renameChat, searchChats as searchChatsAPI, uploadFiles } from "../utils/api"
import type { Chat, Message, Model, SearchEntry } from "../types"
import TooltipButton from "../components/TooltipButton"
import CopyButton from "../components/CopyButton"
import EditButton from "../components/EditButton"
import RegenerateButton from "../components/RegenerateButton"

export default function ChatPage() {
    const { chatUUID } = useParams()
    const { theme, setTheme } = useTheme()

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState<string>("")

    const webSocket = useRef<WebSocket>(null)

    const shouldLoadChats = useRef(true)
    const shouldLoadMessages = useRef(true)

    const [model, setModel] = useState<Model>(() => { return (localStorage.getItem("model") as Model) || "SmolLM2-135M" })

    const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
        const stored = localStorage.getItem("isSidebarVisible")
        return stored === null ? true : stored === "true"
    })
    const [isSettingsVisible, setIsSettingsVisible] = useState(false)
    const [isHidingSettings, setIsHidingSettings] = useState(false)
    const [isSearchVisible, setIsSearchVisible] = useState(false)
    const [isHidingSearch, setIsHidingSearch] = useState(false)
    const [isHidingPopup, setIsHidingPopup] = useState(false)

    const [openDropdownUUID, setOpenDropdownUUID] = useState<string | null>(null)
    const [renamingUUID, setRenamingUUID] = useState<string | null>(null)
    const [renamingTitle, setRenamingTitle] = useState<string>("")

    const settingsRef = useRef<HTMLDivElement | null>(null)
    const searchRef = useRef<HTMLDivElement | null>(null)
    const sidebarRef = useRef<HTMLDivElement | null>(null)
    const popupRef = useRef<HTMLDivElement | null>(null)

    const [searchResults, setSearchResults] = useState<SearchEntry[]>([])
    const [selectedIndex, setSelectedIndex] = useState<number>(-1)

    const [hasChatBegun, setHasChatBegun] = useState(chatUUID !== undefined)

    const [currentFiles, setCurrentFiles] = useState<File[]>([])

    const [editingMessageInput, setEditingMessageInput] = useState("")
    const editingMessageRef = useRef<Message | null>(null)

    const [isAnyChatIncomplete, setIsAnyChatIncomplete] = useState(false)

    const [generatingMessageIndex, setGeneratingMessageIndex] = useState(parseInt(localStorage.getItem("generatingMessageIndex") || "-1"))
    const [regeneratingMessageIndex, setRegeneratingMessageIndex] = useState(parseInt(localStorage.getItem("regeneratingMessageIndex") || "-1"))

    const moveSelectionDown = useCallback(
        throttle(() => {
            setSelectedIndex(previous => searchResults.length > 0 ? Math.min(previous + 1, searchResults.length - 1) : -1)
        }, 100),
        [searchResults.length]
    )

    const moveSelectionUp = useCallback(
        throttle(() => {
            setSelectedIndex(previous => Math.max(previous - 1, 0))
        }, 100),
        []
    )

    const [confirmPopup, setConfirmPopup] = useState<{
        message: string,
        onConfirm: () => void,
        onCancel?: () => void
    } | null>(null)

    function loadChats() {
        if (shouldLoadChats.current) {
            shouldLoadChats.current = false
            getChats().then(setChats)
        }
    }

    function loadMessages() {
        if (shouldLoadMessages.current && chatUUID) {
            shouldLoadMessages.current = false
            getMessages(chatUUID).then(setMessages)
        }
    }

    function receiveMessage() {
        if (!webSocket.current) {
            webSocket.current = new WebSocket(chatUUID ? `ws://${location.host}/ws/chat/${chatUUID}/` : `ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("message", event => {
                const data = JSON.parse(event.data)

                if (data.generating_message_index) {
                    setGeneratingMessageIndex(data.generating_message_index)
                    if (data.generating_message_action === "regenerate_message") {
                        setRegeneratingMessageIndex(data.generating_message_index)
                    }
                }

                const message_index = data.message_index + 1

                if (data.message) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[message_index] = { text: data.message, files: [], is_user_message: false }
                        return messages
                    })
                    resetGeneratingStates()
                } else if (data.token) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[message_index] = { text: messages[message_index].text + data.token, files: [], is_user_message: false }
                        return messages
                    })
                } else if (data.redirect) {
                    location.href = data.redirect
                }
            })

            webSocket.current.addEventListener("error", _ => {
                if (chatUUID) {
                    location.href = "/"
                }
            })
        }
    }

    function sendMessage(event: React.KeyboardEvent) {
        if (webSocket.current && event.key === "Enter" && !event.shiftKey && input.trim()) {
            event.preventDefault()
            getChats(true).then(chats => {
                if (chats.length === 0) {
                    resetGeneratingStates()

                    if (webSocket.current) {
                        setMessages(previous => {
                            let messages = [...previous]
                            messages.push({ text: input, files: currentFiles.map(file => { return { name: file.name } }), is_user_message: true })
                            messages.push({ text: "", files: [], is_user_message: false })
                            return messages
                        })
                        if (currentFiles.length > 0) {
                            uploadFiles(currentFiles).then(files => {
                                if (webSocket.current) {
                                    webSocket.current.send(JSON.stringify({ model: model, message: input, files: files }))
                                    setInput("")
                                    setHasChatBegun(true)
                                    setCurrentFiles([])
                                    setGeneratingMessageIndex(messages.length + 1)
                                }
                            })
                        } else {
                            webSocket.current.send(JSON.stringify({ model: model, message: input }))
                            setInput("")
                            setHasChatBegun(true)
                            setGeneratingMessageIndex(messages.length + 1)
                        }
                    }
                } else {
                    let generatingWarnP = document.querySelector(".generating-warn-p") as HTMLElement

                    if (!generatingWarnP) {
                        generatingWarnP = document.createElement("p")
                        generatingWarnP.className = "generating-warn-p"
                        generatingWarnP.innerHTML = `A message is already being generated in <a href="/chat/${chats[0].uuid}">${chats[0].title}<a>`
                        document.getElementById("chat-div")?.appendChild(generatingWarnP)

                        generatingWarnP.style.filter = "brightness(0.9)"
                        generatingWarnP.style.scale = "0.9"
                    } else {
                        generatingWarnP.style.filter = "brightness(1.1)"
                        generatingWarnP.style.scale = "1.1"
                    }

                    setTimeout(() => {
                        generatingWarnP.style.filter = ""
                        generatingWarnP.style.scale = ""
                    }, 500)

                    setTimeout(() => generatingWarnP.remove(), 3000)
                }
            })
        }
    }

    function getHTMLMessage(message: Message, index: number) {
        return (
            <React.Fragment key={index}>
                {message.is_user_message ? (
                    <div className="user-message-items-div">
                        {message.files.length > 0 && (
                            <div className="attachment-items-div">
                                {message.files.map((file, index) => (
                                    <div key={index} className="attachment-item-div">
                                        <h1 className="attachment-icon-h1">Text</h1>
                                        <div className="attachment-info-div">
                                            <>
                                                <h1 className="attachment-file-h1">{file.name}</h1>
                                                <p className="attachment-type-p">{file.name.endsWith(".txt") ? "Text" : file.name.endsWith(".md") ? "Markdown" : "File"}</p>
                                            </>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {message !== editingMessageRef.current ? (
                            <>
                                <div className="user-message-div">{message.text}</div>
                                <div className="user-message-footer-div">
                                    <TooltipButton
                                        button={<CopyButton buttonClass="tooltip-button" onCopy={() => copyMessage(message, index)}></CopyButton>}
                                        tooltipText="Copy"
                                    ></TooltipButton>
                                    <TooltipButton
                                        button={<EditButton buttonClass="tooltip-button" onEdit={() => handleEditButton(message)}></EditButton>}
                                        tooltipText="Edit"
                                    ></TooltipButton>
                                </div>
                            </>
                        ) : (
                            <div className="message-editor-div">
                                <textarea value={editingMessageInput} onChange={event => setEditingMessageInput(event.target.value)}></textarea>
                                <div>
                                    <button onClick={handleEditorCancelButton}>Cancel</button>
                                    <button
                                        onClick={_ => handleEditorSendButton(message, index)}
                                        disabled={editingMessageInput.trim() === "" || editingMessageInput === message.text}
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bot-message-items-div">
                        <div className="bot-message-div" dangerouslySetInnerHTML={{ __html: createBotMessageHTML(message.text) }}></div>
                        <div className="bot-message-footer-div">
                            <TooltipButton
                                button={<CopyButton buttonClass="tooltip-button" onCopy={() => copyMessage(message, index)}></CopyButton>}
                                tooltipText="Copy"
                            ></TooltipButton>
                            <TooltipButton
                                button={
                                    <RegenerateButton
                                        buttonClass="tooltip-button"
                                        onRegenerate={() => regenerateMesssage(index)}
                                        loading={regeneratingMessageIndex === index}
                                        disabled={generatingMessageIndex >= 0 || regeneratingMessageIndex >= 0 || isAnyChatIncomplete}
                                    ></RegenerateButton>
                                }
                                tooltipText="Regenerate"
                            ></TooltipButton>
                        </div>
                    </div>
                )}
            </React.Fragment>
        )
    }

    function handleEditButton(message: Message) {
        editingMessageRef.current = message
        setEditingMessageInput(message.text)
    }

    function copyMessage(message: Message, index: number) {
        if (message.is_user_message) {
            navigator.clipboard.writeText(message.text)
        } else {
            getMessage(chatUUID!, index).then(text => {
                text ? navigator.clipboard.writeText(text) : alert("Copying of message was not possible")
            })
        }
    }

    function handleEditorCancelButton() {
        editingMessageRef.current = null
        setEditingMessageInput(editingMessageInput === "" ? " " : "")
    }

    function handleEditorSendButton(message: Message, index: number) {
        if (webSocket.current) {
            webSocket.current.send(JSON.stringify({ "action": "edit_message", "model": model, "message": editingMessageInput, message_index: index }))
        }

        setMessages(previous => {
            const messages = [...previous]
            messages[index + 1].text = ""
            return messages
        })

        message.text = editingMessageInput
        editingMessageRef.current = null
        setEditingMessageInput("")
        setGeneratingMessageIndex(index)
    }

    function regenerateMesssage(index: number) {
        setMessages(previous => {
            const messages = [...previous]
            messages[index].text = ""
            return messages
        })

        webSocket.current?.send(JSON.stringify({ "action": "regenerate_message", "model": model, message_index: index }))

        setGeneratingMessageIndex(-1)
        setRegeneratingMessageIndex(index)
    }

    function deleteChatsPopup() {
        setConfirmPopup({
            message: "Are you sure you want to delete all of your chats?",
            onConfirm: () => {
                deleteChats().then(status => {
                    if (status !== 200) {
                        setConfirmPopup({
                            message: "Deletion of chats was not possible",
                            onConfirm: () => setConfirmPopup(null)
                        })
                    } else {
                        if (location.href.includes("/chat/")) {
                            location.href = "/"
                        } else {
                            closePopup()
                            document.getElementById("history-div")!.innerHTML = ""
                        }
                    }
                })
            },
            onCancel: () => closePopup()
        })
    }

    function deleteAccountPopup() {
        setConfirmPopup({
            message: "Are you sure you want to delete your account?",
            onConfirm: () => {
                deleteAccount().then(status => {
                    if (status !== 200) {
                        setConfirmPopup({
                            message: "Deletion of account was not possible",
                            onConfirm: () => setConfirmPopup(null)
                        })
                    } else {
                        location.href = "/"
                    }
                })
            },
            onCancel: () => closePopup()
        })
    }

    function closePopup() {
        setIsHidingPopup(true)
        setTimeout(() => {
            setIsHidingPopup(false)
            setConfirmPopup(null)
        }, 300)
    }

    useEffect(() => {
        loadChats()
        loadMessages()
        receiveMessage()
    }, [])

    useEffect(() => {
        autoResizeTextArea(document.getElementById("prompt-textarea") as HTMLTextAreaElement)
    }, [input])

    useEffect(() => {
        if (editingMessageRef.current) {
            autoResizeTextArea(document.querySelector(".message-editor-div")!.querySelector("textarea")!)
        }
    }, [editingMessageInput])

    useEffect(() => addEventListenerToCodeBlockCopyButtons(), [messages, input, editingMessageInput])
    useEffect(() => localStorage.setItem("isSidebarVisible", String(isSidebarVisible)), [isSidebarVisible])
    useEffect(() => localStorage.setItem("generatingMessageIndex", generatingMessageIndex.toString()), [generatingMessageIndex])
    useEffect(() => localStorage.setItem("regeneratingMessageIndex", regeneratingMessageIndex.toString()), [regeneratingMessageIndex])

    function resetGeneratingStates() {
        setGeneratingMessageIndex(-1)
        setRegeneratingMessageIndex(-1)
        setIsAnyChatIncomplete(false)
    }

    useEffect(() => {
        for (const chat of chats) {
            if (!chat.is_complete) {
                setIsAnyChatIncomplete(true)
                return
            }
        }
        resetGeneratingStates()
    }, [chats])

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

    useEffect(() => {
        localStorage.setItem("model", model)
    }, [model])

    function closeSettings() {
        setIsHidingSettings(true)
        setTimeout(() => {
            setIsHidingSettings(false)
            setIsSettingsVisible(false)
        }, 300)
    }

    useEffect(() => {
        if (!isSettingsVisible) return

        function closeSettingsOnOutsideClick(event: MouseEvent) {
            if (confirmPopup) return

            const target = event.target as Node
            if (
                (settingsRef.current && settingsRef.current.contains(target)) ||
                (popupRef.current && popupRef.current.contains(target))
            ) {
                return
            }

            closeSettings()
        }

        document.addEventListener("mousedown", closeSettingsOnOutsideClick)
        return () => document.removeEventListener("mousedown", closeSettingsOnOutsideClick)
    }, [isSettingsVisible, confirmPopup])

    useEffect(() => {
        if (!isSettingsVisible) return

        function closeSettingsOnEscape(event: KeyboardEvent) {
            if (confirmPopup) return
            if (event.key === "Escape") {
                closeSettings()
            }
        }

        document.addEventListener("keydown", closeSettingsOnEscape)
        return () => document.removeEventListener("keydown", closeSettingsOnEscape)
    }, [isSettingsVisible, confirmPopup])

    function closeSearch() {
        setIsHidingSearch(true)
        setTimeout(() => {
            setIsHidingSearch(false)
            setIsSearchVisible(false)
        }, 300)
    }

    useEffect(() => {
        if (!isSearchVisible) return

        function closeSearchOnOutsideClick(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                closeSearch()
            }
        }

        document.addEventListener("mousedown", closeSearchOnOutsideClick)
        return () => document.removeEventListener("mousedown", closeSearchOnOutsideClick)
    }, [isSearchVisible])

    useEffect(() => {
        if (!isSearchVisible) return

        function closeSearchOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeSearch()
            }
        }

        document.addEventListener("keydown", closeSearchOnEscape)
        return () => document.removeEventListener("keydown", closeSearchOnEscape)
    }, [isSearchVisible])

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

    useEffect(() => {
        if (!isSidebarVisible) return

        function handleClickOutsideSidebar(event: MouseEvent) {
            if (document.body.clientWidth >= 700) return
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsSidebarVisible(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutsideSidebar)
        return () => document.removeEventListener("mousedown", handleClickOutsideSidebar)
    }, [isSidebarVisible])

    function searchChats(search: string) {
        searchChatsAPI(search).then(chats => {
            if (chats) {
                setSearchResults(chats)
            } else {
                alert("Search of chats was not possible")
            }
        })
    }

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
        searchChats("")
        setTimeout(() => document.getElementById("search-input")?.focus(), 300)
    }

    async function handleLogoutButton() {
        await logout()
        location.reload()
    }

    useEffect(() => {
        if (!isSearchVisible) return

        function handleKeyboardNavigation(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeSearch()
            } else if (event.key === "ArrowDown") {
                event.preventDefault()
                moveSelectionDown()
            } else if (event.key === "ArrowUp") {
                event.preventDefault()
                moveSelectionUp()
            } else if (event.key === "Enter" && selectedIndex >= 0 && selectedIndex < searchResults.length) {
                const selected = searchResults[selectedIndex]
                location.href = `/chat/${selected.uuid}`
            }
        }

        document.addEventListener("keydown", handleKeyboardNavigation)
        return () => document.removeEventListener("keydown", handleKeyboardNavigation)
    }, [isSearchVisible, searchResults, selectedIndex, moveSelectionDown, moveSelectionUp])

    useEffect(() => {
        if (selectedIndex < 0) return
        const entries = document.querySelectorAll(".search-entry-a")
        const selected = entries[selectedIndex] as HTMLElement | undefined
        selected?.scrollIntoView({ block: "nearest" })
    }, [selectedIndex])

    useEffect(() => {
        setSelectedIndex(searchResults.length > 0 ? 0 : -1)
    }, [searchResults])

    useEffect(() => {
        document.getElementById("prompt-textarea")?.focus()
    }, [])

    function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (event.target.files) {
            if (event.target.files.length + currentFiles.length > 10) {
                alert("You can only attach up to 10 files at a time.")
                event.target.value = ""
                return
            }

            let totalSize = 0
            for (const file of currentFiles) {
                totalSize += file.size
            }
            for (const file of event.target.files) {
                totalSize += file.size
            }
            if (totalSize > 1_000_000) {
                alert("Total file size exceeds 1 MB limit. Please select smaller files.")
                event.target.value = ""
                return
            }

            const newFiles = Array.from(event.target.files)

            const mergedFiles = [...currentFiles, ...newFiles].filter(
                (file, index, self) =>
                    index === self.findIndex(f => f.name === file.name && f.size === file.size)
            )

            setCurrentFiles(mergedFiles)

            event.target.value = ""
        }
    }

    return (
        <>
            {!isSettingsVisible && <button id="open-settings-button" onClick={_ => setIsSettingsVisible(true)}>⚙</button>}

            {isSettingsVisible && <div id="settings-backdrop-div"></div>}
            {(isSettingsVisible || isHidingSettings) && (
                <div id="settings-div" className={isHidingSettings ? "fade-out" : "fade-in"} ref={settingsRef}>
                    <p id="settings-p">Settings</p>

                    <button id="close-settings-button" onClick={closeSettings}>X</button>

                    <div id="theme-select-div">
                        <label id="theme-select-label">Theme</label>
                        <select id="theme-select" value={theme} onChange={event => setTheme(event.target.value as Theme)}>
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>

                    <div id="delete-chats-button-div">
                        <label id="delete-chats-button-label">Delete all chats</label>
                        <button id="delete-chats-button" onClick={deleteChatsPopup}>Delete all</button>
                    </div>

                    <div id="delete-account-button-div">
                        <label id="delete-account-button-label">Delete account</label>
                        <button id="delete-account-button" onClick={deleteAccountPopup}>Delete</button>
                    </div>

                    <div id="logout-button-div">
                        <label id="logout-button-label">Log out</label>
                        <button id="logout-button" onClick={handleLogoutButton}>Log out</button>
                    </div>
                </div>
            )}

            {isSearchVisible && <div id="search-backdrop-div"></div>}
            {(isSearchVisible || isHidingSearch) && (
                <div id="search-div" className={isHidingSearch ? "fade-out" : "fade-in"} ref={searchRef}>
                    <div id="search-header-div">
                        <input id="search-input" placeholder="Search here..." onInput={event => chats.length > 0 && searchChats(event.currentTarget.value)} />
                        <button id="search-close-button" onClick={closeSearch}>X</button>
                    </div>
                    <div id="search-entries-div">
                        {chats.length === 0 ? (
                            <p>You have no chats to search.</p>
                        ) : (
                            <>{searchResults.length === 0 ? (
                                <p>No chats found.</p>
                            ) : (
                                <>{searchResults.map((entry, index) => (
                                    <a key={entry.uuid} className={`search-entry-a ${index === selectedIndex ? "selected" : ""}`} href={`/chat/${entry.uuid}`}>
                                        {entry.title}
                                        {entry.matches?.length > 0 && (
                                            <ul>
                                                {entry.matches.map((message: string, i: number) => (
                                                    <li key={i}>{message.slice(0, 100)}...</li>
                                                ))}
                                            </ul>
                                        )}
                                    </a>
                                ))}</>
                            )}</>
                        )}
                    </div>
                </div>
            )}

            {document.body.clientWidth < 700 && isSidebarVisible && <div id="sidebar-backdrop-div" onClick={_ => setIsSidebarVisible(false)}></div>}
            <div id="sidebar-div" className={isSidebarVisible ? "visible" : "invisible"} ref={sidebarRef}>
                <div id="buttons-div">
                    <button id="toggle-sidebar-button" onClick={_ => setIsSidebarVisible(previous => !previous)}>
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

            <div id="chat-div">
                <div id="messages-div" className={hasChatBegun ? "expanded" : ""}>{messages.map((message, index) => getHTMLMessage(message, index))}</div>
                {hasChatBegun === false && <h1 id="new-chat-h1">Ask me anything</h1>}
                {currentFiles.length > 0 && (
                    <div className="attachment-items-div">
                        {currentFiles.map((file, index) => (
                            <div key={index} className="attachment-item-div">
                                <button className="attachment-remove-button" onClick={() => setCurrentFiles(currentFiles.filter((_, i) => i !== index))}>X</button>
                                <h1 className="attachment-icon-h1">Text</h1>
                                <div className="attachment-info-div">
                                    <>
                                        <h1 className="attachment-file-h1">{file.name}</h1>
                                        <p className="attachment-type-p">{file.name.endsWith(".txt") ? "Text" : file.name.endsWith(".md") ? "Markdown" : "File"}</p>
                                    </>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div id="prompt-div">
                    <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here..."></textarea>
                    <div id="prompt-footer-div">
                        <select id="model-select" value={model} onChange={event => setModel(event.target.value as Model)}>
                            <option value="SmolLM2-135M" className="model-select-option">SmolLM2-135M</option>
                            <option value="SmolLM2-360M" className="model-select-option">SmolLM2-360M</option>
                            <option value="SmolLM2-1.7B" className="model-select-option">SmolLM2-1.7B</option>
                        </select>
                        <div id="attachment-div">
                            <label id="attachment-label" htmlFor="attachment-input">📎</label>
                            <input id="attachment-input" type="file" onChange={handleFilesChange} multiple />
                        </div>
                    </div>
                </div>
            </div>

            {confirmPopup && <ConfirmPopup message={confirmPopup.message} isHiding={isHidingPopup} ref={popupRef} onConfirm={confirmPopup.onConfirm} onCancel={confirmPopup.onCancel} />}
        </>
    )
}

function autoResizeTextArea(textArea: HTMLTextAreaElement) {
    const fontSize = Math.round(parseInt(getComputedStyle(textArea).fontSize) * 1.25)
    const charactersPerLine = Math.round((textArea.clientWidth - fontSize) / fontSize) * 2

    let lines = 0
    let j = 0
    for (let i = 0; i < textArea.value.length; i++) {
        if (j >= charactersPerLine || textArea.value[i] === "\n") {
            lines += 1
            j = 0
            continue
        }
        j += 1
    }

    const height = Math.min(lines * fontSize + fontSize * 2, Math.round(document.body.scrollHeight * 0.5))
    textArea.style.height = height + "px"
}

function createBotMessageHTML(message: string) {
    const botMessageDiv = document.createElement("div")
    botMessageDiv.innerHTML = message

    const codehilites = botMessageDiv.querySelectorAll(".codehilite")
    codehilites.forEach(codehilite => {
        const codeBlockHeaderDiv = document.createElement("div")
        codeBlockHeaderDiv.className = "code-block-header-div"

        const codeBlockHeaderP = document.createElement("p")
        codeBlockHeaderP.className = "code-block-header-p"
        codeBlockHeaderP.textContent = codehilite.getAttribute("data-language") || "code"
        codeBlockHeaderDiv.appendChild(codeBlockHeaderP)

        const codeBlockHeaderButton = document.createElement("button")
        codeBlockHeaderButton.className = "code-block-header-button"
        codeBlockHeaderButton.textContent = "Copy"
        codeBlockHeaderDiv.appendChild(codeBlockHeaderButton)

        codehilite.insertBefore(codeBlockHeaderDiv, codehilite.childNodes[0])
    })

    return botMessageDiv.innerHTML
}

function addEventListenerToCodeBlockCopyButtons() {
    const botMessageDivs = document.querySelectorAll(".bot-message-div")
    botMessageDivs.forEach(botMessageDiv => {
        const buttons = botMessageDiv.querySelectorAll(".code-block-header-button")
        buttons.forEach(button => {
            button.addEventListener("click", _ => {
                const code = button.parentElement?.nextElementSibling?.textContent
                if (code) {
                    navigator.clipboard.writeText(code).then(_ => {
                        const originalText = button.textContent
                        button.textContent = "Copied!"
                        setTimeout(() => { button.textContent = originalText }, 2000)
                    })
                }
            })
        })
    })
}