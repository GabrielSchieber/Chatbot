import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import { t } from "i18next"
import React, { useEffect, useRef, useState, type ReactElement } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import Attachments from "./Attachments"
import { CopyButton, EditButton, RegenerateButton } from "./Buttons"
import Editor from "./Editor"
import { useChat } from "../providers/ChatProvider"
import type { MessageFile, Model } from "../utils/types"

export default function Messages() {
    const { chatUUID } = useParams()

    const { setChats, messages, setMessages, isMobile } = useChat()

    const webSocket = useRef<WebSocket | null>(null)
    const ref = useRef<HTMLDivElement | null>(null)

    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)

    const [editingMessageIndex, setEditingMessageIndex] = useState(-1)

    function handleScroll() {
        if (!ref.current) return
        const atBottom = ref.current.scrollHeight - ref.current.clientHeight - ref.current.scrollTop <= 20
        if (!atBottom) setShouldScrollToBottom(false)
    }

    useEffect(() => {
        if (!webSocket.current) {
            webSocket.current = new WebSocket("/ws/chat/")

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
                } else if (data.title) {
                    setChats(previous => previous.map(c => c.pending_message_id !== null ? { ...c, title: data.title } : c))
                } else if (data === "end") {
                    setChats(previous => previous.map(c => ({ ...c, pending_message_id: null })))
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
        <div ref={ref} className={`flex flex-col w-full px-2 py-10 items-center overflow-y-auto ${!chatUUID ? "h-[35%]" : "h-full"}`} onScroll={handleScroll}>
            <div className={`flex flex-col gap-3 ${isMobile ? "w-full" : "w-[60vw]"}`}>
                {messages.map((m, i) =>
                    <React.Fragment key={i}>
                        {editingMessageIndex === i ? (
                            <Editor index={i} setIndex={setEditingMessageIndex} />
                        ) : m.is_from_user ? (
                            <UserMessage index={i} text={m.text} files={m.files} onEditClick={() => setEditingMessageIndex(i)} />
                        ) : (
                            <BotMessage index={i} text={m.text} model={m.model} />
                        )}
                    </React.Fragment>
                )}
            </div>
        </div>
    )
}

function UserMessage({ index, text, files, onEditClick }: { index: number, text: string, files: MessageFile[], onEditClick: VoidFunction }) {
    return (
        <div className="flex flex-col gap-1 self-end">
            <div className="flex flex-col gap-3 px-4 py-3 wrap-anywhere whitespace-pre-wrap rounded-2xl bg-gray-800 light:bg-gray-200">
                {files.length > 0 &&
                    <div className="flex flex-wrap gap-2 p-2 rounded-xl border bg-gray-700 light:bg-gray-300 border-gray-200 light:border-gray-800">
                        <Attachments files={files} />
                    </div>
                }

                <div className="wrap-anywhere whitespace-pre-wrap" data-testid={`message-${index}`}>
                    {text}
                </div>
            </div>

            <div className="flex self-end gap-2 px-2">
                <EditButton onClick={onEditClick} />
                <CopyButton text={text} data-testid="copy" />
            </div>
        </div>
    )
}

function BotMessage({ index, text, model }: { index: number, text: string, model: Model | null }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="wrap-anywhere whitespace-pre-wrap" data-testid={`message-${index}`}>
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
                                            {copied ? t("copyButton.tooltip.clicked") : t("copyButton.tooltip")}
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

            <div className="flex gap-2">
                <CopyButton text={text} />
                <RegenerateButton index={index} model={model} />
            </div>
        </div>
    )
}