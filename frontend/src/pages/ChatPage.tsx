import { useState, useEffect, useRef } from "react"
import "./ChatPage.css"
import { isLoggedIn, logout } from "../auth"

type Message = string | { markdown: string; html: string }

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const currentBotMessageRef = useRef("")
    const [currentBotMessage, setCurrentBotMessage] = useState("")
    const socket = useRef<WebSocket | null>(null)
    const acessToken = localStorage.getItem("access_token")

    const sendMessage = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (socket.current && event.key === "Enter" && !event.shiftKey && input.trim()) {
            event.preventDefault()
            setInput("")
            setMessages(previous => [...previous, input])
            setCurrentBotMessage("")
            socket.current.send(JSON.stringify({ message: input }))
        }
    }

    const receiveMessage = () => {
        socket.current = new WebSocket(`ws://${window.location.host}/ws/chat/?token=${acessToken}`)

        socket.current.addEventListener("message", event => {
            const data = JSON.parse(event.data)
            if (data.token) {
                currentBotMessageRef.current += data.token
                setCurrentBotMessage(currentBotMessageRef.current)
            } else if (data.message) {
                setMessages(previous => [...previous, data.message])
                currentBotMessageRef.current = ""
                setCurrentBotMessage("")
            }
        })

        return () => socket.current?.close()
    }

    useEffect(() => {
        receiveMessage()
        autoAdaptTheme()
        autoResizePromptTextArea()
    })

    return (
        <>
            {isLoggedIn() && <button id="logout-button" onClick={handleLogout}>Log out</button>}
            <div id="chat-div">
                <div id="messages-div">
                    {messages.map(message => (
                        <>
                            {typeof (message) === "string" ? (
                                <div className={getMessageDivClassName(message)}>{message}</div>
                            ) : (
                                <div className={getMessageDivClassName(message)} dangerouslySetInnerHTML={{ __html: message["html"] }}></div>
                            )}
                            <button className="copy-button" onClick={copyMessage(message)}>Copy</button>
                        </>
                    ))}
                    {currentBotMessage && (<div className="bot-message-div">{currentBotMessage}</div>)}
                </div>
                <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here.." />
            </div >
        </>
    )
}

function autoAdaptTheme() {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
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
    return typeof (message) === "string" ? "user-message-div" : "bot-message-div"
}

function copyMessage(message: Message) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget
        const text = (typeof (message) === "string" ? message : message["markdown"]) || ""
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = "Copied!"
            setTimeout(() => { button.textContent = "Copy" }, 2000)
        })
    }
}

async function handleLogout() {
    await logout()
    location.reload()
}