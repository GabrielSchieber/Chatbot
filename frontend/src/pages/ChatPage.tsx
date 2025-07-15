import React from "react"
import { useState, useEffect, useRef } from "react"
import "./ChatPage.css"
import { logout } from "../auth"
import { useParams } from "react-router"

type Message = { index: number, text: string }

export default function ChatPage() {
    const { chatUUID } = useParams()

    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const currentBotMessageRef = useRef("")
    const [currentBotMessage, setCurrentBotMessage] = useState("")
    const socket = useRef<WebSocket | null>(null)
    const shouldLoadMessages = useRef(true)

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

        socket.current!.addEventListener("message", event => {
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

        return () => socket.current?.close()
    }

    useEffect(() => {
        loadMessages()
        receiveMessage()
        autoAdaptTheme()
        autoResizePromptTextArea()
    }, [])

    useEffect(() => {
        handleCopyingOfCodeBlocks(messages)
    }, [messages, input])

    return (
        <>
            {<button id="logout-button" onClick={handleLogout}>Log out</button>}
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