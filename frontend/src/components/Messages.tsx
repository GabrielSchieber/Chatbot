import { CheckIcon, CopyIcon, FileIcon, Pencil1Icon, UpdateIcon } from "@radix-ui/react-icons"
import { Tooltip } from "radix-ui"
import React, { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import { getChats, getMessage, getMessages, editMessage as editMessageAPI, renegerateMessage as regenerateMessageAPI } from "../utils/api"
import { getFileSize, getFileType } from "../utils/file"
import type { Message, MessageFile } from "../types"

export default function Messages({ webSocket, messages, setMessages, isAnyChatIncomplete, setIsAnyChatIncomplete }: {
    webSocket: React.RefObject<WebSocket | null>
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    isAnyChatIncomplete: boolean
    setIsAnyChatIncomplete: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const { chatUUID } = useParams()
    const shouldLoadMessages = useRef(true)
    const [copiedMessageIndex, setCopiedMessageIndex] = useState(-1)
    const [editingMessageIndex, setEditingMessageIndex] = useState(-1)
    const [editingMessageText, setEditingMessageText] = useState("")

    function MessageButton({ children, onClick, tooltip, isDisabled = false }: { children: ReactNode, onClick: () => void, tooltip: string, isDisabled?: boolean }) {
        return (
            <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                    <Tooltip.Trigger
                        className={`p-2 rounded-lg hover:bg-gray-700 light:hover:bg-gray-300 ${isDisabled ? "opacity-50" : "cursor-pointer"}`}
                        onClick={onClick}
                        disabled={isDisabled}
                    >
                        {children}
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className="text-white text-sm bg-black px-2 py-1 rounded-xl" side="bottom" sideOffset={3}>
                            {tooltip}
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </Tooltip.Provider>
        )
    }

    function CopyButton({ message, index }: { message: Message, index: number }) {
        return (
            <MessageButton
                children={
                    copiedMessageIndex === index ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />
                }
                tooltip="Copy"
                onClick={() => copyMessage(message, index)}
            />
        )
    }

    function EditButton({ message, index }: { message: Message, index: number }) {
        return (
            <MessageButton
                children={<Pencil1Icon />}
                tooltip="Edit"
                onClick={() => {
                    setEditingMessageIndex(index)
                    setEditingMessageText(message.text)
                }}
                isDisabled={isAnyChatIncomplete}
            />
        )
    }

    function RegenerateButton({ index }: { index: number }) {
        return (
            <MessageButton
                children={
                    <UpdateIcon className="size-4.5" />
                }
                tooltip="Regenerate"
                onClick={() => regenerateMessage(index)}
                isDisabled={isAnyChatIncomplete}
            />
        )
    }

    function FileItem({ file }: { file: MessageFile }) {
        return (
            <div className="relative flex gap-1 p-2 w-fit items-center bg-gray-800/50 rounded-xl">
                <FileIcon className="size-14 bg-gray-800 p-2 rounded-lg" />
                <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                    <p className="px-2 py-1 rounded-lg bg-gray-800">
                        Type: {getFileType(file.name)}<br />
                        Name: {file.name}<br />
                        Size: {getFileSize(file.content_size)}
                    </p>
                </div>
            </div>
        )
    }

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
                if (data.token) {
                    setMessages(previous => {
                        let previousMessages = [...previous]
                        if (previousMessages[message_index]) {
                            previousMessages[message_index] = { text: previousMessages[message_index].text + data.token, files: [], role: "Bot" }
                        }
                        return previousMessages
                    })
                } else if (data.message) {
                    setMessages(previous => {
                        let previousMessages = [...previous]
                        if (previousMessages[message_index]) {
                            previousMessages[message_index] = { text: data.message, files: [], role: "Bot" }
                        }
                        return previousMessages
                    })
                    setIsAnyChatIncomplete(false)
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
        if (message.role === "User") {
            navigator.clipboard.writeText(message.text)
        } else {
            if (chatUUID) {
                getMessage(chatUUID, index).then(text => {
                    text ? navigator.clipboard.writeText(text) : alert("Copying of message was not possible")
                })
            }
        }
        setCopiedMessageIndex(index)
        setTimeout(() => setCopiedMessageIndex(-1), 2000)
    }

    function editMessage(index: number) {
        if (chatUUID) {
            editMessageAPI(chatUUID, "SmolLM2-135M", editingMessageText, index).then(([_, status]) => {
                if (status === 200) {
                    setMessages(previous => {
                        const messages = [...previous]
                        messages[index].text = editingMessageText
                        messages[index + 1].text = ""
                        return messages
                    })

                    setEditingMessageIndex(-1)
                    setEditingMessageText("")
                    setIsAnyChatIncomplete(true)
                }
            })
        } else {
            alert("Edition of message was not possible")
        }
    }

    function regenerateMessage(index: number) {
        if (chatUUID) {
            regenerateMessageAPI(chatUUID, "SmolLM2-135M", index).then(([_, status]) => {
                if (status === 200) {
                    setMessages(previous => {
                        const messages = [...previous]
                        messages[index].text = ""
                        return messages
                    })
                    setIsAnyChatIncomplete(true)
                }
            })
        } else {
            alert("Edition of message was not possible")
        }
    }

    useEffect(() => {
        loadMessages()
        receiveMessage()
        getChats(true).then(chats => chats.length > 0 ? setIsAnyChatIncomplete(true) : setIsAnyChatIncomplete(false))
    }, [])

    return (
        <div className="flex flex-col gap-2 pt-10 pb-25 items-center overflow-y-auto">
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`flex flex-col gap-0.5 w-[50vw] justify-self-center ${message.role === "User" ? "items-end" : "items-start"}`}
                >
                    {editingMessageIndex === index ? (
                        <div className="flex flex-col gap-1 w-[80%] max-h-100 px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300">
                            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                                {message.files.length > 0 && (
                                    <div className="flex flex-col gap-1 p-2 rounded-lg border border-gray-500">
                                        {message.files.map((file, fileIndex) => (
                                            <FileItem key={fileIndex} file={file} />
                                        ))}
                                    </div>
                                )}
                                <div className="flex">
                                    <textarea
                                        className="flex-1 p-2 overflow-y-hidden resize-none outline-none"
                                        value={editingMessageText}
                                        onChange={e => {
                                            setEditingMessageText(e.target.value)
                                            e.currentTarget.style.height = "auto"
                                            e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-1 justify-end">
                                <button
                                    className="
                                        px-3 py-1 rounded-lg cursor-pointer bg-gray-800
                                        hover:bg-gray-800/60 light:bg-gray-200 light:hover:bg-gray-200/60
                                    "
                                    onClick={_ => {
                                        setEditingMessageIndex(-1)
                                        setEditingMessageText("")
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="
                                        px-3 py-1 rounded-lg cursor-pointer text-black light:text-white bg-gray-100 hover:bg-gray-200
                                        light:bg-gray-900 light:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                                    "
                                    onClick={_ => editMessage(index)}
                                    disabled={editingMessageText.trim() === ""}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    ) : (
                        message.role === "User" ? (
                            <div className="flex flex-col gap-1 min-w-20 max-w-[80%] px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300">
                                {message.files.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        {message.files.map((file, index) => (
                                            <FileItem key={index} file={file} />
                                        ))}
                                    </div>
                                )}
                                <div className="whitespace-pre-wrap">
                                    {message.text}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full whitespace-pre-wrap">
                                <ReactMarkdown
                                    children={message.text}
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                    components={{
                                        code({ node, className, children, ...props }) {
                                            const isInline = !className
                                            if (isInline) {
                                                return (
                                                    <code className="px-1 bg-gray-700 light:bg-gray-300 rounded" {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            }
                                            return <code className={className} {...props}>{children}</code>
                                        },

                                        pre({ node, children, ...props }) {
                                            const [copied, setCopied] = useState(false)

                                            function copyCodeBlock(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
                                                const codeBlock = e.currentTarget?.parentElement?.parentElement?.querySelector("pre")
                                                navigator.clipboard.writeText(codeBlock?.textContent || "")
                                                setCopied(true)
                                                setTimeout(() => setCopied(false), 2000)
                                            }

                                            const childArray = React.Children.toArray(children)
                                            const codeNode = childArray[0] as ReactElement<{ className?: string, children?: React.ReactNode }>

                                            const className = codeNode?.props.className || ""
                                            const languageMatch = /language-(\w+)/.exec(className)
                                            const language = languageMatch ? languageMatch[1] : "code"

                                            return (
                                                <div className="rounded-lg overflow-hidden my-2">
                                                    <div className="flex items-center justify-between bg-gray-700 light:bg-gray-300 px-4 py-1">
                                                        <p className="text-sm m-0">{language}</p>
                                                        <button
                                                            className="
                                                            flex items-center gap-1 px-2 py-[2px] text-xs cursor-pointer
                                                            rounded hover:bg-gray-800 light:hover:bg-gray-200
                                                        "
                                                            onClick={copyCodeBlock}
                                                        >
                                                            {copied ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
                                                            {copied ? "Copied" : "Copy"}
                                                        </button>
                                                    </div>
                                                    <pre className="overflow-x-auto m-0" {...props}>
                                                        {children}
                                                    </pre>
                                                </div>
                                            )
                                        }
                                    }}
                                />
                            </div>
                        )
                    )}

                    {editingMessageIndex !== index && (
                        <div className="flex gap-1">
                            {message.role === "User" ? (
                                <>
                                    <EditButton message={message} index={index} />
                                    <CopyButton message={message} index={index} />
                                </>
                            ) : (
                                <>
                                    <CopyButton message={message} index={index} />
                                    <RegenerateButton index={index} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}