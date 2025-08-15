import type { Chat, Message, Model, UIAttachment } from "../../types"
import TooltipButton from "../../components/TooltipButton"
import CopyButton from "../../components/CopyButton"
import EditButton from "../../components/EditButton"
import RegenerateButton from "../../components/RegenerateButton"
import { getChats, getMessage, getMessages, uploadFiles } from "../../utils/api"
import "./Chat.css"
import { useEffect, useRef, useState } from "react"
import React from "react"

interface ChatProps {
    chatUUID: string | undefined
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
}

export default function Chat({ chatUUID, chats, setChats }: ChatProps) {
    const webSocket = useRef<WebSocket>(null)

    const [input, setInput] = useState<string>("")
    const [model, setModel] = useState<Model>(() => { return (localStorage.getItem("model") as Model) || "SmolLM2-135M" })
    const [messages, setMessages] = useState<Message[]>([])

    const shouldLoadChats = useRef(true)
    const shouldLoadMessages = useRef(true)

    const [hasChatBegun, setHasChatBegun] = useState(chatUUID !== undefined)

    const [currentFiles, setCurrentFiles] = useState<File[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])

    const editingMessageRef = useRef<Message | null>(null)
    const [editingMessageInput, setEditingMessageInput] = useState("")

    const [isAnyChatIncomplete, setIsAnyChatIncomplete] = useState(false)

    const [generatingMessageIndex, setGeneratingMessageIndex] = useState(parseInt(localStorage.getItem("generatingMessageIndex") || "-1"))
    const [regeneratingMessageIndex, setRegeneratingMessageIndex] = useState(parseInt(localStorage.getItem("regeneratingMessageIndex") || "-1"))

    useEffect(() => {
        loadChats()
        loadMessages()
        receiveMessage()
    }, [])

    useEffect(() => addEventListenerToCodeBlockCopyButtons(), [messages, input, editingMessageInput])
    useEffect(() => localStorage.setItem("generatingMessageIndex", generatingMessageIndex.toString()), [generatingMessageIndex])
    useEffect(() => localStorage.setItem("regeneratingMessageIndex", regeneratingMessageIndex.toString()), [regeneratingMessageIndex])

    useEffect(() => {
        document.getElementById("prompt-textarea")?.focus()
    }, [])

    useEffect(() => {
        autoResizeTextArea(document.getElementById("prompt-textarea") as HTMLTextAreaElement)
    }, [input])

    useEffect(() => {
        if (editingMessageRef.current) {
            autoResizeTextArea(document.querySelector(".message-editor-div")!.querySelector("textarea")!)
        }
    }, [editingMessageInput])

    useEffect(() => {
        localStorage.setItem("model", model)
    }, [model])

    useEffect(() => {
        for (const chat of chats) {
            if (!chat.is_complete) {
                setIsAnyChatIncomplete(true)
                return
            }
        }
        resetGeneratingStates()
    }, [chats])

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
                                    setVisibleFiles([])
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
                webSocket.current.send(
                    JSON.stringify({ "action": "edit_message", "model": model, "message": editingMessageInput, message_index: index })
                )

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
        }

        function regenerateMesssage(index: number) {
            if (webSocket.current) {
                webSocket.current.send(JSON.stringify({ "action": "regenerate_message", "model": model, message_index: index }))

                setMessages(previous => {
                    const messages = [...previous]
                    messages[index].text = ""
                    return messages
                })

                setGeneratingMessageIndex(-1)
                setRegeneratingMessageIndex(index)
            }
        }

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
                                                <p className="attachment-type-p">
                                                    {file.name.endsWith(".txt") ? "Text" : file.name.endsWith(".md") ? "Markdown" : "File"}
                                                </p>
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

    function handleRemoveAttachment(id: string) {
        const ui = visibleFiles.find(a => a.id === id)
        if (!ui) return

        setCurrentFiles(previous => previous.filter(f => !(f.name === ui.file.name && f.size === ui.file.size)))

        setVisibleFiles(previous => previous.map(a => (a.id === id ? { ...a, isRemoving: true } : a)))

        setTimeout(() => setVisibleFiles(previous => previous.filter(a => a.id !== id)), 300)
    }

    function resetGeneratingStates() {
        setGeneratingMessageIndex(-1)
        setRegeneratingMessageIndex(-1)
        setIsAnyChatIncomplete(false)
    }

    function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
        function getID() {
            return Math.random().toString(36).slice(2) + Date.now().toString(36)
        }

        if (!event.target.files) return

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

        const existingKeys = new Set(currentFiles.map(f => f.name + "|" + f.size))
        const uniqueNew = newFiles.filter(f => !existingKeys.has(f.name + "|" + f.size))

        setCurrentFiles(previous => [...previous, ...uniqueNew])

        setVisibleFiles(previous => [
            ...previous,
            ...uniqueNew.map(f => ({ id: getID(), file: f, isRemoving: false }))
        ])

        event.target.value = ""
    }

    return (
        <div id="chat-div">
            <div id="messages-div" className={hasChatBegun ? "expanded" : ""}>
                {messages.map((message, index) => getHTMLMessage(message, index))}
            </div>

            {hasChatBegun === false && <h1 id="new-chat-h1">Ask me anything</h1>}

            {visibleFiles.length > 0 && (
                <div className="attachment-items-div">
                    <div className="attachment-items-div">
                        {visibleFiles.map(attachment => (
                            <div key={attachment.id} className={`attachment-item-div ${attachment.isRemoving ? "removing" : ""}`}>
                                <button className="attachment-remove-button" onClick={() => handleRemoveAttachment(attachment.id)}>X</button>
                                <h1 className="attachment-icon-h1">Text</h1>
                                <div className="attachment-info-div">
                                    <>
                                        <h1 className="attachment-file-h1">{attachment.file.name}</h1>
                                        <p className="attachment-type-p">
                                            {attachment.file.name.endsWith(".txt")
                                                ? "Text"
                                                : attachment.file.name.endsWith(".md")
                                                    ? "Markdown"
                                                    : "File"}
                                        </p>
                                    </>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div id="prompt-div">
                <textarea
                    id="prompt-textarea"
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    onKeyDown={event => sendMessage(event)}
                    placeholder="Type here...">
                </textarea>
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