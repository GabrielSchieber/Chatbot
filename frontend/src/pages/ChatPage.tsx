import React from "react"
import { useState, useEffect, useRef } from "react"
import "./ChatPage.css"
import { logout } from "../auth"
import { useParams } from "react-router"

type Chat = { title: string, uuid: string }
type Message = { index: number, text: string }

export default function ChatPage() {
    const { chatUUID } = useParams()

    const [chats, setChats] = useState<Chat[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const currentBotMessageRef = useRef("")
    const [currentBotMessage, setCurrentBotMessage] = useState("")
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
        if (socket.current && event.key === "Enter" && !event.shiftKey && input.trim()) {
            event.preventDefault()
            setInput("")
            setMessages(previous => [...previous, { index: previous.length, text: input }])
            setCurrentBotMessage("")
            socket.current.send(JSON.stringify({ message: input }))
        }
    }

    const receiveMessage = () => {
        const webSocketURL = chatUUID ? `ws://${location.host}/ws/chat/${chatUUID}/` : `ws://${location.host}/ws/chat/`
        socket.current = new WebSocket(webSocketURL)

        socket.current.addEventListener("message", event => {
            const data = JSON.parse(event.data)
            if (data.token) {
                currentBotMessageRef.current += data.token
                setCurrentBotMessage(currentBotMessageRef.current)
            } else if (data.message) {
                setMessages(previous => [...previous, { index: previous.length, text: data.message }])
                currentBotMessageRef.current = ""
                setCurrentBotMessage("")
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
        autoAdaptTheme()
        autoResizePromptTextArea()

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest(".past-chat-div")) {
                setOpenDropdownUUID(null)
            }
        }
        document.addEventListener("click", handleClickOutside)
        return () => {
            document.removeEventListener("click", handleClickOutside)
        }
    }, [])

    useEffect(() => { handleCopyingOfCodeBlocks(messages) }, [messages, input])
    useEffect(() => { localStorage.setItem("isSidebarVisible", String(isSidebarVisible)) }, [isSidebarVisible])

    return (
        <>
            {!isSettingsVisible && <button id="open-settings-button" onClick={_ => setIsSettingsVisible(true)}>⚙</button>}

            {isSettingsVisible &&
                <div id="settings-div">
                    <p id="settings-p">Settings</p>
                    <button id="close-settings-button" onClick={_ => setIsSettingsVisible(false)}>X</button>
                    <button id="delete-account-button" onClick={handleAccountDeletion}>Delete account</button>
                    <button id="logout-button" onClick={handleLogout}>Log out</button>
                </div>
            }

            <div id="sidebar-div" className={isSidebarVisible ? "visible" : "invisible"}>
                <div id="buttons-div">
                    <button id="toggle-sidebar-button" onClick={() => setIsSidebarVisible(prev => !prev)}>≡</button>
                    <button id="new-chat-button" onClick={handleNewChat}>✏</button>
                </div>
                <div id="history-div">
                    {chats.map(chat => (
                        <div key={chat.uuid} className="past-chat-div">
                            {renamingUUID === chat.uuid ? (
                                <input
                                    className="past-chat-rename-input"
                                    type="text"
                                    value={renamingTitle}
                                    onChange={e => setRenamingTitle(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && renamingTitle.trim()) {
                                            renameChat(chat, renamingTitle.trim())
                                            setChats(prev =>
                                                prev.map(c =>
                                                    c.uuid === chat.uuid ? { ...c, title: renamingTitle.trim() } : c
                                                )
                                            )
                                            setRenamingUUID(null)
                                        } else if (e.key === "Escape") {
                                            setRenamingUUID(null)
                                        }
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <a className="past-chat-a" href={`/chat/${chat.uuid}`}>{chat.title}</a>
                            )}
                            <button
                                className="past-chat-dropdown-button"
                                onClick={() =>
                                    setOpenDropdownUUID(prev => (prev === chat.uuid ? null : chat.uuid))
                                }
                            >
                                ≡
                            </button>
                            {openDropdownUUID === chat.uuid && (
                                <div className="past-chat-dropdown-div">
                                    <button
                                        className="past-chat-rename-button"
                                        onClick={() => {
                                            setRenamingUUID(chat.uuid)
                                            setRenamingTitle(chat.title)
                                            setOpenDropdownUUID(null)
                                        }}
                                    >
                                        Rename
                                    </button>
                                    <button
                                        className="past-chat-delete-button"
                                        onClick={() => {
                                            if (confirm("Are you sure you want to delete this chat?")) {
                                                deleteChat(chat)
                                                setChats(prev => prev.filter(c => c.uuid !== chat.uuid))
                                                if (location.pathname.includes(chat.uuid)) {
                                                    location.href = "/"
                                                }
                                            }
                                            setOpenDropdownUUID(null)
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

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
                    {currentBotMessage && (<div className="bot-message-div">{currentBotMessage}</div>)}
                </div>
                <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here.." />
            </div>
        </>
    )
}

function autoAdaptTheme() {
    if (matchMedia("(prefers-color-scheme: dark)").matches) {
        import("./code_dark.css")
    } else {
        import("./code_light.css")
    }
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

function handleNewChat() {
    location.href = "/"
}

async function handleLogout() {
    await logout()
    location.reload()
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

function handleCopyingOfCodeBlocks(messages: Message[]) {
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

function handleAccountDeletion() {
    if (confirm("Are you sure you want to delete your account?")) {
        fetch("/api/delete-ccount/", { method: "POST", credentials: "include" }).then(response => {
            if (response.status !== 200) {
                alert("Deletion of account was not possible")
            } else {
                location.href = "/"
            }
        })
    }
}