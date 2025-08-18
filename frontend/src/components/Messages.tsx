import { CopyIcon } from "@radix-ui/react-icons"
import type { Message } from "../types"
import { getMessage, getMessages } from "../utils/api"
import { useParams } from "react-router"
import { useEffect, useRef } from "react"

export default function Messages({ webSocket, messages, setMessages }: {
    webSocket: React.RefObject<WebSocket | null>
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
    const { chatUUID } = useParams()
    const shouldLoadMessages = useRef(true)

    function loadMessages() {
        if (shouldLoadMessages.current && chatUUID) {
            shouldLoadMessages.current = false
            getMessages(chatUUID).then(messages => {
                if (messages) {
                    setMessages(messages)
                } else {
                    location.href = "/"
                }
            })
        }
    }

    function receiveMessage() {
        if (!webSocket.current) {
            webSocket.current = new WebSocket(chatUUID ? `ws://${location.host}/ws/chat/${chatUUID}/` : `ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("message", event => {
                const data = JSON.parse(event.data)

                const message_index = data.message_index + 1

                if (data.message) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages[message_index] = { text: data.message, files: [], is_user_message: false }
                        return messages
                    })
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

    function copyMessage(message: Message, index: number) {
        if (message.is_user_message) {
            navigator.clipboard.writeText(message.text)
        } else {
            if (chatUUID) {
                getMessage(chatUUID, index).then(text => {
                    text ? navigator.clipboard.writeText(text) : alert("Copying of message was not possible")
                })
            }
        }
    }

    useEffect(() => {
        loadMessages()
        receiveMessage()
    }, [])

    useEffect(() => addEventListenerToCodeBlockCopyButtons(), [messages, prompt])

    return (
        <div className="flex-1 overflow-y-auto w-full">
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`flex flex-col w-[50vw] justify-self-center ${message.is_user_message ? "items-end" : "items-start"} gap-2`}
                >
                    {message.is_user_message ? (
                        <div className="px-3 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap bg-gray-700 text-white">
                            {message.text}
                        </div>
                    ) : (
                        <div
                            className="bot-message whitespace-pre-wrap text-gray-300"
                            dangerouslySetInnerHTML={{ __html: createBotMessageHTML(message.text) }}
                        ></div>
                    )}
                    <button
                        className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-transparent rounded-lg transition-all duration-200 bg cursor-pointer"
                        onClick={_ => copyMessage(message, index)}
                    >
                        <CopyIcon />
                    </button>
                </div>
            ))}
        </div>
    )
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
    const botMessageDivs = document.querySelectorAll(".bot-message")
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