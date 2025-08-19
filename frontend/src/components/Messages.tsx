import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import React, { type ReactElement, useEffect, useRef, useState } from "react"
import { useParams } from "react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"

import { getMessage, getMessages } from "../utils/api"
import type { Message } from "../types"

export default function Messages({ webSocket, messages, setMessages }: {
    webSocket: React.RefObject<WebSocket | null>
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
    const { chatUUID } = useParams()
    const shouldLoadMessages = useRef(true)
    const [copiedMessageIndex, setCopiedMessageIndex] = useState(-1)

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
        setCopiedMessageIndex(index)
        setTimeout(() => setCopiedMessageIndex(-1), 2000)
    }

    useEffect(() => {
        loadMessages()
        receiveMessage()
    }, [])

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
                        <div className="w-full whitespace-pre-wrap text-gray-300">
                            <ReactMarkdown
                                children={message.text}
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                                components={{
                                    code({ node, className, children, ...props }) {
                                        const isInline = !className
                                        if (isInline) {
                                            return (
                                                <code className="px-1 bg-gray-700 rounded" {...props}>
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
                                                <div className="flex items-center justify-between bg-gray-700 px-4 py-1">
                                                    <p className="text-sm m-0">{language}</p>
                                                    <button
                                                        className="flex items-center gap-1 px-2 py-[2px] text-xs rounded bg-gray-600 hover:bg-gray-500"
                                                        onClick={copyCodeBlock}
                                                    >
                                                        {copied ? <CheckIcon className="scale-[1.3]" /> : <CopyIcon />}
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
                    <button
                        className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-all duration-200 bg cursor-pointer"
                        onClick={_ => copyMessage(message, index)}
                    >
                        {copiedMessageIndex === index ? <CheckIcon className="scale-[1.5]" /> : <CopyIcon className="scale-[1.2]" />}
                    </button>
                </div>
            ))}
        </div>
    )
}