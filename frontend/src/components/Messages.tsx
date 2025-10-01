import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import React, { useEffect, useRef, useState, type ReactElement } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import { getMessages } from "../utils/api"
import type { Message as MessageType } from "../types"

export default function Messages({ messages, setMessages }: {
    messages: MessageType[]
    setMessages: React.Dispatch<React.SetStateAction<MessageType[]>>
}) {
    const { chatUUID } = useParams()

    const webSocket = useRef<WebSocket | null>(null)
    const ref = useRef<HTMLDivElement | null>(null)

    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)

    function handleScroll() {
        const el = ref.current
        if (!el) return
        // consider user at bottom if within 20px of the end
        const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 20
        if (!atBottom) setShouldScrollToBottom(false)
    }

    useEffect(() => {
        if (chatUUID) {
            getMessages(chatUUID).then(response => {
                if (response.ok) {
                    response.json().then(data => {
                        setMessages(data)
                    })
                } else {
                    alert("Failed to get messages")
                }
            })
        }

        if (!webSocket.current) {
            webSocket.current = new WebSocket(`ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("open", _ => {
                if (webSocket.current && chatUUID) {
                    webSocket.current.send(JSON.stringify({ chat_uuid: chatUUID }))
                }
            })

            webSocket.current.addEventListener("message", e => {
                const data = JSON.parse(e.data)

                if (data.token || data.message) {
                    let shouldSetMessages = true
                    setMessages(previous => {
                        if (shouldSetMessages) {
                            shouldSetMessages = false

                            previous = [...previous]

                            const message = previous[data.message_index]
                            if (message) {
                                if (data.token) {
                                    message.text += data.token
                                } else {
                                    message.text = data.message
                                }
                            }
                        }

                        return previous
                    })
                }
            })

            webSocket.current.addEventListener("error", _ => location.href = "/")
        }

        if (webSocket.current.readyState === WebSocket.OPEN && chatUUID) {
            webSocket.current.send(JSON.stringify({ chat_uuid: chatUUID }))
        }
    }, [chatUUID])

    useEffect(() => setShouldScrollToBottom(true), [messages.length])

    useEffect(() => {
        if (shouldScrollToBottom) {
            requestAnimationFrame(_ => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "auto" }))
        }
    }, [shouldScrollToBottom, messages.at(-1)?.text])

    return (
        <div
            ref={ref}
            className="flex flex-col size-full px-5 overflow-y-auto"
            style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
            onScroll={handleScroll}
        >
            {messages.map(m => (
                <Message key={m.id} text={m.text} isFromUser={m.is_from_user} />
            ))}
        </div>
    )
}

function UserMessage({ text }: { text: string }) {
    return (
        <div className="w-[50%] m-3 p-3 self-end whitespace-pre-wrap rounded-2xl bg-blue-600 light:bg-blue-300">
            {text}
        </div>
    )
}

function BotMessage({ text }: { text: string }) {
    return (
        <div className="w-[50%] m-3 p-3 self-start whitespace-pre-wrap rounded-2xl bg-gray-700 light:bg-gray-300">
            <ReactMarkdown
                children={text}
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
}

function Message({ text, isFromUser }: { text: string, isFromUser: boolean }) {
    return (
        isFromUser ? (
            <UserMessage text={text} />
        ) : (
            <BotMessage text={text} />
        )
    )
}