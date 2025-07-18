import React from "react"
import { useState, useEffect, useRef } from "react"
import { useParams } from "react-router"

import "./ChatPage.css"
import { logout } from "../auth"

type Chat = { title: string, uuid: string }
type Message = { index: number, text: string }
type Theme = "system" | "light" | "dark"
type SearchResults = { title: string, matches: string[], uuid: string }

autoAdaptTheme()

export default function ChatPage() {
    const { chatUUID } = useParams()

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const socket = useRef<WebSocket | null>(null)
    const shouldLoadChats = useRef(true)
    const shouldLoadMessages = useRef(true)
    const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
        const stored = localStorage.getItem("isSidebarVisible")
        return stored === null ? true : stored === "true"
    })
    const [openDropdownUUID, setOpenDropdownUUID] = useState<string | null>(null)
    const [renamingUUID, setRenamingUUID] = useState<string | null>(null)
    const [renamingTitle, setRenamingTitle] = useState<string>("")
    const [isSettingsVisible, setIsSettingsVisible] = useState(false)
    const [isHidingSettings, setIsHidingSettings] = useState(false)
    const [theme, setTheme] = useState<Theme>(() => { return (localStorage.getItem("theme") as Theme) || "system" })
    const settingsRef = useRef<HTMLDivElement | null>(null)
    const [isSearchVisible, setIsSearchVisible] = useState(false)
    const [isHidingSearch, setIsHidingSearch] = useState(false)
    const searchRef = useRef<HTMLDivElement | null>(null)
    const [searchResults, setSearchResults] = useState<SearchResults[]>([])

    const loadChats = () => {
        if (shouldLoadChats.current && chats.length === 0) {
            shouldLoadChats.current = false

            fetch("/api/get-chats/", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" }
            }).then(response => response.json()).then(data => {
                if (data.chats) {
                    for (let i = 0; i < data.chats.length; i++) {
                        setChats(previous => [...previous, data.chats[i]])
                    }
                } else {
                    alert("Fetching of chats was not possible")
                }
            })
        }
    }

    const loadMessages = () => {
        if (shouldLoadMessages.current && messages.length === 0 && chatUUID) {
            shouldLoadMessages.current = false

            fetch("/api/get-messages/", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_uuid: chatUUID })
            }).then(response => response.json()).then(data => {
                if (data.messages) {
                    for (let i = 0; i < data.messages.length; i++) {
                        setMessages(previous => [...previous, { index: previous.length, text: data.messages[i] }])
                    }
                } else {
                    alert("Fetching of messages was not possible")
                }
            })
        }
    }

    const sendMessage = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (socket.current && input.trim()) {
                setInput("")
                setMessages(previous => [...previous, { index: previous.length, text: input }])
                setMessages(previous => [...previous, { index: previous.length, text: "" }])
                socket.current.send(JSON.stringify({ message: input }))
            }
        }
    }

    const receiveMessage = () => {
        const webSocketURL = chatUUID ? `ws://${location.host}/ws/chat/${chatUUID}/` : `ws://${location.host}/ws/chat/`
        socket.current = new WebSocket(webSocketURL)

        socket.current.addEventListener("message", event => {
            const data = JSON.parse(event.data)
            const botMessageDivs = document.querySelectorAll(".bot-message-div")
            const lastBotMessageDiv = botMessageDivs[botMessageDivs.length - 1]
            if (data.recover) {
                lastBotMessageDiv.textContent = data.recover
            } else if (data.token) {
                lastBotMessageDiv.textContent += data.token
            } else if (data.message) {
                lastBotMessageDiv.innerHTML = data.message
            } else if (data.redirect) {
                location.href = data.redirect
            }
        })

        socket.current.addEventListener("error", _ => {
            if (chatUUID) {
                location.href = "/"
            }
        })

        return () => socket.current?.close()
    }

    useEffect(() => {
        loadChats()
        loadMessages()
        receiveMessage()
        autoResizePromptTextArea()
    }, [])

    useEffect(() => { addEventListenerToCodeBlockCopyButtons(messages) }, [messages, input])
    useEffect(() => { localStorage.setItem("isSidebarVisible", String(isSidebarVisible)) }, [isSidebarVisible])

    useEffect(() => {
        const closeDropdownOnOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest(".past-chat-div")) {
                setOpenDropdownUUID(null)
            }
        }
        document.addEventListener("click", closeDropdownOnOutsideClick)
        return () => {
            document.removeEventListener("click", closeDropdownOnOutsideClick)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem("theme", theme)
        autoAdaptTheme()
    }, [theme])

    useEffect(() => {
        if (!isSettingsVisible) return

        const closeSettingsOnOutsideClick = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                closeSettings()
            }
        }

        document.addEventListener("mousedown", closeSettingsOnOutsideClick)
        return () => {
            document.removeEventListener("mousedown", closeSettingsOnOutsideClick)
        }
    }, [isSettingsVisible])

    useEffect(() => {
        if (!isSettingsVisible) return

        const closeSettingsOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeSettings()
            }
        }

        document.addEventListener("keydown", closeSettingsOnEscape)
        return () => {
            document.removeEventListener("keydown", closeSettingsOnEscape)
        }
    }, [isSettingsVisible])

    const closeSettings = () => {
        setIsHidingSettings(true)
        setTimeout(() => {
            setIsHidingSettings(false)
            setIsSettingsVisible(false)
        }, 300)
    }

    const closeSearch = () => {
        setIsHidingSearch(true)
        setTimeout(() => {
            setIsHidingSearch(false)
            setIsSearchVisible(false)
        }, 300)
    }

    useEffect(() => {
        if (!isSearchVisible) return

        const closeSearchOnOutsideClick = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                closeSearch()
            }
        }

        document.addEventListener("mousedown", closeSearchOnOutsideClick)
        return () => {
            document.removeEventListener("mousedown", closeSearchOnOutsideClick)
        }
    }, [isSearchVisible])

    useEffect(() => {
        if (!isSearchVisible) return

        const closeSearchOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeSearch()
            }
        }

        document.addEventListener("keydown", closeSearchOnEscape)
        return () => {
            document.removeEventListener("keydown", closeSearchOnEscape)
        }
    }, [isSearchVisible])

    const searchChats = (search: string) => {
        fetch("/api/search-chats/", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ search: search })
        }).then(response => response.json()).then(data => {
            if (data.chats) {
                setSearchResults(data.chats)
            } else {
                alert("Search of chats was not possible")
            }
        })
    }

    const handleRenameChatButton = (chat: Chat) => {
        setRenamingUUID(chat.uuid)
        setRenamingTitle(chat.title)
        setOpenDropdownUUID(null)
    }

    const handleDeleteChatButton = (chat: Chat) => {
        if (confirm("Are you sure you want to delete this chat?")) {
            deleteChat(chat)
            setChats(prev => prev.filter(c => c.uuid !== chat.uuid))
            if (location.pathname.includes(chat.uuid)) {
                location.href = "/"
            }
        }
        setOpenDropdownUUID(null)
    }

    const handleRenameInput = (event: React.KeyboardEvent, chat: Chat) => {
        if (event.key === "Enter" && renamingTitle.trim()) {
            renameChat(chat, renamingTitle.trim())
            setChats(prev =>
                prev.map(c =>
                    c.uuid === chat.uuid ? { ...c, title: renamingTitle.trim() } : c
                )
            )
            setRenamingUUID(null)
        } else if (event.key === "Escape") {
            setRenamingUUID(null)
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
                        <button id="delete-chats-button" onClick={deleteChats}>Delete all</button>
                    </div>

                    <div id="delete-account-button-div">
                        <label id="delete-account-button-label">Delete account</label>
                        <button id="delete-account-button" onClick={deleteAccount}>Delete</button>
                    </div>

                    <div id="logout-button-div">
                        <label id="logout-button-label">Log out</label>
                        <button id="logout-button" onClick={async _ => { await logout(); location.reload() }}>Log out</button>
                    </div>
                </div>
            )}

            {isSearchVisible && <div id="search-backdrop-div"></div>}
            {(isSearchVisible || isHidingSearch) && (
                <div id="search-div" className={isHidingSearch ? "fade-out" : "fade-in"} ref={searchRef}>
                    <input id="search-input" placeholder="Search here..." onInput={event => searchChats(event.currentTarget.value)} />
                    <div id="search-entries-div">
                        {searchResults.map(entry => (
                            <a key={entry.uuid} className="search-entry-a" href={`/chat/${entry.uuid}`}>
                                {entry.title}
                                {entry.matches?.length > 0 && (
                                    <ul>
                                        {entry.matches.map((message: string, index: number) => (
                                            <li key={index}>{message.slice(0, 100)}...</li>
                                        ))}
                                    </ul>
                                )}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            <div id="sidebar-div" className={isSidebarVisible ? "visible" : "invisible"}>
                <div id="buttons-div">
                    <button id="toggle-sidebar-button" onClick={() => setIsSidebarVisible(prev => !prev)}>
                        <span className="buttons-icon-span">≡</span>
                        <span className="buttons-text-span">Close sidebar</span>
                    </button>
                    <button id="open-search-button" onClick={() => { setIsSearchVisible(true); searchChats("") }}>
                        <span className="buttons-icon-span">🔍</span>
                        <span className="buttons-text-span">Search chats</span>
                    </button>
                    <a id="new-chat-a" href="/">
                        <span className="buttons-icon-span">✏</span>
                        <span className="buttons-text-span">New Chat</span>
                    </a>
                </div>
                <div id="history-div">
                    {chats.map(chat => (
                        <div key={chat.uuid} className="past-chat-div">
                            {renamingUUID === chat.uuid ? (
                                <input className="past-chat-rename-input" type="text" value={renamingTitle} onChange={e => setRenamingTitle(e.target.value)} onKeyDown={e => { handleRenameInput(e, chat) }} autoFocus />
                            ) : (
                                <a className="past-chat-a" href={`/chat/${chat.uuid}`}>{chat.title}</a>
                            )}
                            <button className="past-chat-dropdown-button" onClick={() => setOpenDropdownUUID(prev => (prev === chat.uuid ? null : chat.uuid))}>≡</button>
                            {openDropdownUUID === chat.uuid && (
                                <div className="past-chat-dropdown-div">
                                    <button className="past-chat-rename-button" onClick={() => { handleRenameChatButton(chat) }}>Rename</button>
                                    <button className="past-chat-delete-button" onClick={() => { handleDeleteChatButton(chat) }}>Delete</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div >

            <div id="chat-div">
                <div id="messages-div">
                    {messages.map(message => (
                        <React.Fragment key={message.index}>
                            {message.index % 2 === 0 ? (
                                <div className={getMessageDivClassName(message)}>{message.text}</div>
                            ) : (
                                <div id={`bot-message-${message.index}`} className={getMessageDivClassName(message)} dangerouslySetInnerHTML={{ __html: createBotMessageHTML(message) }}></div>
                            )}
                            <button className="copy-button" onClick={copyMessage(chatUUID!, message)}>Copy</button>
                        </React.Fragment>
                    ))}
                </div>
                <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here.." />
            </div>
        </>
    )
}

function autoAdaptTheme() {
    const theme = localStorage.getItem("theme")
    switch (theme) {
        case "light":
            document.documentElement.classList.remove("dark")
            document.documentElement.classList.add("light")
            updateCodeTheme("light")
            break
        case "dark":
            document.documentElement.classList.remove("light")
            document.documentElement.classList.add("dark")
            updateCodeTheme("dark")
            break
        default:
            document.documentElement.classList.remove("light", "dark")
            updateCodeTheme("system")
    }
}

function updateCodeTheme(theme: Theme) {
    let link = document.getElementById("code-block-theme-link") as HTMLLinkElement
    if (!link) {
        link = document.createElement("link")
        link.id = "code-block-theme-link"
        link.rel = "stylesheet"
    }
    switch (theme) {
        case "light":
            link.href = "/src/pages/code_light.css"
            break
        case "dark":
            link.href = "/src/pages/code_dark.css"
            break
        default:
            link.href = matchMedia("(prefers-color-scheme: dark)").matches ? "/src/pages/code_dark.css" : "/src/pages/code_light.css"
            break
    }
    document.head.appendChild(link)
}

function autoResizePromptTextArea() {
    const rezize = () => {
        const charactersPerLine = Math.round((promptTextArea.clientWidth - promptTextAreaFontSize) / promptTextAreaFontSize) * 2

        let lines = 0
        let j = 0
        for (let i = 0; i < promptTextArea.value.length; i++) {
            if (j >= charactersPerLine || promptTextArea.value[i] === "\n") {
                lines += 1
                j = 0
                continue
            }
            j += 1
        }

        const height = Math.min(lines * promptTextAreaFontSize + promptTextAreaFontSize * 2, Math.round(document.body.scrollHeight * 0.5))
        messagesDiv.style.height = (document.body.scrollHeight - height) + "px"
        promptTextArea.style.height = height + "px"
    }

    const messagesDiv = document.getElementById("messages-div") as HTMLDivElement
    const promptTextArea = document.getElementById("prompt-textarea") as HTMLTextAreaElement
    const promptTextAreaFontSize = Math.round(parseInt(getComputedStyle(promptTextArea).fontSize) * 1.25)

    promptTextArea.addEventListener("input", rezize)
    window.addEventListener("resize", rezize)
    rezize()
}

function getMessageDivClassName(message: Message) {
    return message.index % 2 === 0 ? "user-message-div" : "bot-message-div"
}

function copyMessage(chatUUID: string, message: Message) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget

        const writeToClipboard = (text: string) => {
            navigator.clipboard.writeText(text).then(() => {
                button.textContent = "Copied!"
                setTimeout(() => { button.textContent = "Copy" }, 2000)
            })
        }

        if (message.index % 2 === 0) {
            writeToClipboard(message.text)
        } else {
            fetch("/api/get-message/", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_uuid: chatUUID, message_index: message.index })
            }).then(response => response.json()).then(data => {
                if (data.text) {
                    writeToClipboard(data.text)
                } else {
                    alert("Copying of message was not possible")
                }
            })
        }
    }
}

function createBotMessageHTML(message: Message) {
    const botMessageDiv = document.createElement("div")
    botMessageDiv.innerHTML = message.text

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

function addEventListenerToCodeBlockCopyButtons(messages: Message[]) {
    messages.forEach(message => {
        if (message.index % 2 !== 0) {
            const root = document.getElementById(`bot-message-${message.index}`)
            if (root) {
                const buttons = root.querySelectorAll(".code-block-header-button")
                buttons.forEach(button => {
                    button.addEventListener("click", () => {
                        const code = button.parentElement?.nextElementSibling?.textContent
                        if (code) {
                            navigator.clipboard.writeText(code).then(() => {
                                const originalText = button.textContent
                                button.textContent = "Copied!"
                                setTimeout(() => { button.textContent = originalText }, 2000)
                            })
                        }
                    })
                })
            }
        }
    })
}

function renameChat(chat: Chat, newTitle: string) {
    fetch("/api/rename-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chat.uuid, new_title: newTitle })
    }).then(response => {
        if (response.status !== 200) {
            alert("Renaming of chat was not possible")
        }
    })
}

function deleteChat(chat: Chat) {
    fetch("/api/delete-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chat.uuid })
    }).then(response => {
        if (response.status !== 200) {
            alert("Deletion of chat was not possible")
        }
    })
}

function deleteChats() {
    if (confirm("Are you sure you want to delete all of your chats?")) {
        fetch("/api/delete-chats/", { method: "POST", credentials: "include" }).then(response => {
            if (response.status !== 200) {
                alert("Deletion of chats was not possible")
            } else {
                location.href = "/"
            }
        })
    }
}

function deleteAccount() {
    if (confirm("Are you sure you want to delete your account?")) {
        fetch("/api/delete-account/", { method: "POST", credentials: "include" }).then(response => {
            if (response.status !== 200) {
                alert("Deletion of account was not possible")
            } else {
                location.href = "/"
            }
        })
    }
}