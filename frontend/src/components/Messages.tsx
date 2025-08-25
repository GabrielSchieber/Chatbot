import { CheckIcon, CopyIcon, FileIcon, UpdateIcon } from "@radix-ui/react-icons"
import { Tooltip } from "radix-ui"
import React, { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import { getChats, getMessage, getMessages } from "../utils/api"
import type { Message } from "../types"

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
                            previousMessages[message_index] = { text: previousMessages[message_index].text + data.token, files: [], is_user_message: false }
                        }
                        return previousMessages
                    })
                } else if (data.message) {
                    setMessages(previous => {
                        let previousMessages = [...previous]
                        if (previousMessages[message_index]) {
                            previousMessages[message_index] = { text: data.message, files: [], is_user_message: false }
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
        if (message.is_user_message) {
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

    function regenerateMessage(index: number) {
        if (webSocket.current) {
            webSocket.current.send(JSON.stringify({ action: "regenerate_message", message_index: index }))
            setIsAnyChatIncomplete(true)
            setMessages(previous => {
                const messages = [...previous]
                messages[index].text = ""
                return messages
            })
        }
    }

    function getFileType(name: string) {
        const fileTypes = new Map(
            [[".txt", "Text"], [".md", "Markdown"], [".py", "Python"], [".js", "JavaScript"]]
        )
        for (const fileType of fileTypes) {
            if (name.endsWith(fileType[0])) {
                return fileType[1]
            }
        }
        return "File"
    }

    useEffect(() => {
        loadMessages()
        receiveMessage()
        getChats(true).then(chats => chats.length > 0 ? setIsAnyChatIncomplete(true) : setIsAnyChatIncomplete(false))
    }, [])

    return (
        <div className="flex-1 overflow-y-auto w-full pt-10 pb-25">
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`flex flex-col w-[50vw] justify-self-center ${message.is_user_message ? "items-end" : "items-start"} gap-2`}
                >
                    {message.is_user_message ? (
                        <div className="flex flex-col gap-1 max-w-[80%]">
                            {message.files.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    {message.files.map((file, index) => (
                                        <div key={index} className="flex items-center gap-1 px-2 py-1 border border-gray-500 bg-gray-800 rounded-xl">
                                            <FileIcon className="size-9 p-1 rounded-md bg-gray-900" />
                                            <div>
                                                <p className="text-sm rounded-xl">{file.name}</p>
                                                <p className="text-sm rounded-xl">{getFileType(file.name)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="px-3 py-2 rounded-2xl whitespace-pre-wrap bg-gray-700 light:bg-gray-300">
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
                    )}

                    <div className="flex gap-1">
                        {message.is_user_message ? (
                            <CopyButton message={message} index={index} />
                        ) : (
                            <>
                                <CopyButton message={message} index={index} />
                                <RegenerateButton index={index} />
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}