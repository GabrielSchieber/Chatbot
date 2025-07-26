import React from "react"
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import "./ChatPage.css"
import { logout } from "../auth"

type Chat = { title: string, uuid: string }
type Message = { text: string, index: number }
type Theme = "system" | "light" | "dark"
type SearchResults = { title: string, matches: string[], uuid: string }

autoAdaptTheme()

export default function ChatPage() {
    const { chatUUID } = useParams()

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState<string>("")

    const webSocket = useRef<WebSocket>(null)

    const shouldLoadChats = useRef(true)
    const shouldLoadMessages = useRef(true)

    const [theme, setTheme] = useState<Theme>(() => { return (localStorage.getItem("theme") as Theme) || "system" })

    const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
        const stored = localStorage.getItem("isSidebarVisible")
        return stored === null ? true : stored === "true"
    })
    const [isSettingsVisible, setIsSettingsVisible] = useState(false)
    const [isHidingSettings, setIsHidingSettings] = useState(false)
    const [isSearchVisible, setIsSearchVisible] = useState(false)
    const [isHidingSearch, setIsHidingSearch] = useState(false)

    const [openDropdownUUID, setOpenDropdownUUID] = useState<string | null>(null)
    const [renamingUUID, setRenamingUUID] = useState<string | null>(null)
    const [renamingTitle, setRenamingTitle] = useState<string>("")

    const settingsRef = useRef<HTMLDivElement | null>(null)
    const searchRef = useRef<HTMLDivElement | null>(null)
    const sidebarRef = useRef<HTMLDivElement | null>(null)

    const [searchResults, setSearchResults] = useState<SearchResults[]>([])

    function loadChats() {
        if (shouldLoadChats.current) {
            shouldLoadChats.current = false
            fetch("/api/get-chats/", {
                credentials: "include",
                headers: { "Content-Type": "application/json" }
            }).then(response => response.json()).then(data => {
                if (data.chats) {
                    data.chats.forEach((chat: Chat) => setChats(previous => [...previous, chat]))
                } else {
                    alert("Fetching of messages was not possible")
                }
            })
        }
    }

    function loadMessages() {
        if (shouldLoadMessages.current && chatUUID) {
            shouldLoadMessages.current = false
            fetch("/api/get-messages/", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_uuid: chatUUID })
            }).then(response => response.json()).then(data => {
                if (data.messages) {
                    data.messages.forEach((message: string, index: number) => setMessages(previous => [...previous, { text: message, index: index }]))
                } else {
                    alert("Fetching of messages was not possible")
                }
            })
        }
    }

    function receiveMessage() {
        if (!webSocket.current) {
            webSocket.current = new WebSocket(chatUUID ? `ws://${location.host}/ws/chat/${chatUUID}/` : `ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("message", event => {
                const data = JSON.parse(event.data)
                if (data.recover || data.message) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[messages.length - 1] = { text: data.recover ? data.recover : data.message, index: messages.length - 1 }
                        return messages
                    })
                } else if (data.token) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[messages.length - 1] = { text: messages[messages.length - 1].text + data.token, index: messages.length - 1 }
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
            fetch("/api/get-chats/", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ incomplete: true })
            }).then(response => response.json()).then(data => {
                if (data.chats.length === 0) {
                    if (webSocket.current) {
                        setMessages(previous => {
                            let messages = [...previous]
                            messages.push({ text: input, index: messages.length })
                            messages.push({ text: "", index: messages.length })
                            return messages
                        })
                        webSocket.current.send(JSON.stringify({ message: input }))
                        setInput("")
                    }
                } else {
                    let generatingWarnP = document.querySelector(".generating-warn-p") as HTMLElement

                    if (!generatingWarnP) {
                        generatingWarnP = document.createElement("p")
                        generatingWarnP.className = "generating-warn-p"
                        generatingWarnP.innerHTML = `A message is already being generated in <a href="/chat/${data.chats[0].uuid}">${data.chats[0].title}<a>`
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

                    setTimeout(() => { generatingWarnP.remove() }, 3000)
                }
            })
        }
    }

    function getHTMLMessage(message: Message) {
        return (
            <React.Fragment key={message.index}>
                {message.index % 2 === 0 ? (
                    <div className="user-message-div">{message.text}</div>
                ) : (
                    <div className="bot-message-div" dangerouslySetInnerHTML={{ __html: createBotMessageHTML(message.text) }}></div>
                )}
                <button className="copy-button" onClick={copyMessage(chatUUID!, message)}>Copy</button>
            </React.Fragment>
        )
    }

    useEffect(() => {
        loadChats()
        loadMessages()
        receiveMessage()
        autoResizePromptTextArea()
    }, [])

    useEffect(() => { addEventListenerToCodeBlockCopyButtons() }, [messages, input])
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

    const closeSettings = () => {
        setIsHidingSettings(true)
        setTimeout(() => {
            setIsHidingSettings(false)
            setIsSettingsVisible(false)
        }, 300)
    }

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

    // Add effect to close sidebar on outside click for small screens
    useEffect(() => {
        if (!isSidebarVisible) return

        const handleClickOutsideSidebar = (event: MouseEvent) => {
            if (document.body.clientWidth >= 700) return
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsSidebarVisible(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutsideSidebar)
        return () => {
            document.removeEventListener("mousedown", handleClickOutsideSidebar)
        }
    }, [isSidebarVisible])

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

            {document.body.clientWidth < 700 && isSidebarVisible && <div id="sidebar-backdrop-div" onClick={() => setIsSidebarVisible(false)}></div>}
            <div id="sidebar-div" className={isSidebarVisible ? "visible" : "invisible"} ref={sidebarRef}>
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
                        <div key={chat.uuid} className={`past-chat-div${chat.uuid === chatUUID ? " selected" : ""}`}>
                            {renamingUUID === chat.uuid ? (
                                <input className="past-chat-rename-input" type="text" value={renamingTitle} onChange={e => setRenamingTitle(e.target.value)} onKeyDown={e => { handleRenameInput(e, chat) }} autoFocus />
                            ) : (
                                <a className="past-chat-a" href={`/chat/${chat.uuid}`}>{chat.title}</a>
                            )}
                            <button className="past-chat-dropdown-button" onClick={() => setOpenDropdownUUID(prev => (prev === chat.uuid ? null : chat.uuid))}>≡</button>
                            {openDropdownUUID === chat.uuid && (
                                <DropdownDiv>
                                    <button className="past-chat-rename-button" onClick={() => { handleRenameChatButton(chat) }}>Rename</button>
                                    <button className="past-chat-delete-button" onClick={() => { handleDeleteChatButton(chat) }}>Delete</button>
                                </DropdownDiv>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div id="chat-div">
                <div id="messages-div">{messages.map(getHTMLMessage)}</div>
                <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here..."></textarea>
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
            link.href = "/assets/code_light.css"
            break
        case "dark":
            link.href = "/assets/code_dark.css"
            break
        default:
            link.href = matchMedia("(prefers-color-scheme: dark)").matches ? "/assets/code_dark.css" : "/assets/code_light.css"
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
        fetch("/api/delete-chats/", { credentials: "include" }).then(response => {
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
        fetch("/api/delete-account/", { credentials: "include" }).then(response => {
            if (response.status !== 200) {
                alert("Deletion of account was not possible")
            } else {
                location.href = "/"
            }
        })
    }
}

function DropdownDiv({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    const [openUpwards, setOpenUpwards] = useState(false)

    useEffect(() => {
        const dropdown = ref.current
        if (dropdown) {
            const rect = dropdown.getBoundingClientRect()
            const overflowBottom = rect.bottom > window.innerHeight
            setOpenUpwards(overflowBottom)
        }
    }, [])

    return <div ref={ref} className={`past-chat-dropdown-div${openUpwards ? " open-upwards" : ""}`}>{children}</div>
}