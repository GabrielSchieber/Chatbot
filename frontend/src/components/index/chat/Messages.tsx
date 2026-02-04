import { ArrowDownIcon, CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import { AnimatePresence, motion } from "motion/react"
import React, { useEffect, useRef, useState, type ReactElement } from "react"
import { useTranslation } from "react-i18next"
import Markdown from "react-markdown"
import { useParams } from "react-router"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import Attachments from "./messages/Attachments"
import Editor from "./messages/Editor"
import { CopyButton, EditButton, RegenerateButton } from "../../misc/Buttons"
import { useChat } from "../../../providers/ChatProvider"
import type { MessageFile, Model } from "../../../utils/types"

export default function Messages({
    chatRef,
    hasSentMessage,
    introductionRef
}: {
    chatRef: React.RefObject<HTMLDivElement | null>
    hasSentMessage: React.RefObject<boolean>
    introductionRef: React.RefObject<HTMLHeadingElement | null>
}) {
    const { chatUUID } = useParams()

    const { setChats, messages, setMessages, isMobile, promptHeight } = useChat()

    const webSocket = useRef<WebSocket | null>(null)
    const ref = useRef<HTMLDivElement | null>(null)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const previousMessagesLength = useRef(0)
    const lastTimeScrolled = useRef(0)

    const [isBottomVisible, setIsBottomVisible] = useState(true)
    const [editingMessageIndex, setEditingMessageIndex] = useState(-1)

    function scrollToBottom() {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
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

    useEffect(() => {
        if (previousMessagesLength.current === 0) {
            previousMessagesLength.current = messages.length
            const id = setInterval(() => { scrollToBottom() }, 100)
            setTimeout(() => { clearInterval(id) }, 500)
        }
    }, [chatUUID, messages.length])

    useEffect(() => {
        if (isBottomVisible && (Date.now() - lastTimeScrolled.current) > 100) {
            lastTimeScrolled.current = Date.now()
            scrollToBottom()
        }
    }, [messages.at(-1)?.text])

    useEffect(() => {
        if (!chatRef.current || !bottomRef.current) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsBottomVisible(entry.isIntersecting)
            },
            {
                root: chatRef.current,
                threshold: 0.9
            }
        )

        observer.observe(bottomRef.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!ref.current) return

        const handleResize = (entries: ResizeObserverEntry[]) => {
            if (!introductionRef.current) return

            for (const entry of entries) {
                if (entry.target === ref.current) {
                    introductionRef.current.style.transform = `translateY(${entry.target.clientHeight - introductionRef.current.clientHeight / 3}px)`
                }
            }
        }

        resizeObserverRef.current = new ResizeObserver(handleResize)
        resizeObserverRef.current.observe(ref.current)
        return () => resizeObserverRef.current?.disconnect()
    }, [])

    useEffect(() => {
        if (hasSentMessage.current) {
            resizeObserverRef.current?.disconnect()
        }
    }, [hasSentMessage.current])

    return (
        <motion.div
            layout={hasSentMessage.current}
            initial={chatUUID ? {
                flex: 1,
                padding: "15px 0",
                opacity: 100
            } : {
                flex: isMobile ? 0.5 : 0.8,
                padding: "0 0",
                opacity: 0
            }}
            animate={chatUUID ? {
                flex: 1,
                padding: "15px 0",
                opacity: 100
            } : {
                flex: isMobile ? 0.5 : 0.8,
                padding: "0 0",
                opacity: 0
            }}
            transition={{ type: "tween", duration: 0.5 }}
            ref={ref}
            className="flex flex-col w-full gap-5 items-center"
        >
            {messages.map((m, i) =>
                <div key={i} className={`flex flex-col transition-all duration-500 ${isMobile ? "w-full px-3" : "w-[60vw]"}`}>
                    {editingMessageIndex === i ? (
                        <Editor index={i} setIndex={setEditingMessageIndex} />
                    ) : m.is_from_user ? (
                        <UserMessage index={i} text={m.text} files={m.files} onEditClick={() => setEditingMessageIndex(i)} />
                    ) : (
                        <BotMessage index={i} text={m.text} model={m.model} />
                    )}
                </div>
            )}

            <div ref={bottomRef} />

            <AnimatePresence>
                {!isBottomVisible && (
                    <motion.button
                        key="scroll-to-bottom"

                        initial={{ opacity: 0, y: 6, bottom: promptHeight + 16 }}
                        animate={{ opacity: 1, y: 0, bottom: promptHeight + 16 }}
                        exit={{ opacity: 0, y: 6, bottom: promptHeight + 16 }}
                        transition={{
                            opacity: { duration: 0.15 },
                            y: { duration: 0.15, ease: "easeOut" },
                            bottom: { type: "tween", duration: 0.2, ease: "easeOut" }
                        }}

                        className="
                            fixed place-self-center p-1 rounded-full cursor-pointer border border-zinc-700
                            bg-zinc-900 hover:bg-zinc-800
                            light:bg-zinc-100 light:hover:bg-zinc-200
                        "
                        onClick={scrollToBottom}
                        aria-label="Scroll to bottom"
                    >
                        <ArrowDownIcon className="size-5" />
                    </motion.button>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export function UserMessage({ index, text, files, onEditClick }: { index: number, text: string, files?: MessageFile[], onEditClick?: VoidFunction }) {
    return (
        <div className="flex flex-col gap-1 self-end">
            <div className="flex flex-col gap-3 px-4 py-3 wrap-anywhere whitespace-pre-wrap rounded-3xl bg-zinc-800 light:bg-zinc-50">
                {files && files.length > 0 && <Attachments files={files} />}

                <div className="wrap-anywhere whitespace-pre-wrap" data-testid={`message-${index}`}>
                    {text}
                </div>
            </div>

            <div className="flex self-end gap-2 px-2">
                {onEditClick && <EditButton onClick={onEditClick} />}
                <CopyButton text={text} data-testid="copy" />
            </div>
        </div>
    )
}

export function BotMessage({ index, text, model }: { index: number, text: string, model?: Model | null }) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-1">
            <div className="prose dark:prose-invert max-w-none">
                <Markdown
                    children={text}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
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
                                    <div className="flex px-4 items-center justify-between bg-zinc-900 light:bg-zinc-200">
                                        <p className="text-sm m-0">{language}</p>
                                        <button
                                            className="
                                                flex items-center gap-1 px-2 py-1 text-xs cursor-pointer
                                                rounded hover:bg-zinc-800 light:hover:bg-zinc-300
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
                {model !== undefined && <RegenerateButton index={index} model={model} />}
            </div>
        </div>
    )
}