import { CheckIcon, CopyIcon, Pencil1Icon, UpdateIcon } from "@radix-ui/react-icons"
import React, { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import { getMessages } from "../utils/api"
import type { Message, Model } from "../types"
import { DropdownMenu, Tooltip } from "radix-ui"

export default function Messages({ messages, setMessages }: {
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
    const { chatUUID } = useParams()

    const webSocket = useRef<WebSocket | null>(null)
    const ref = useRef<HTMLDivElement | null>(null)

    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)

    function handleScroll() {
        if (!ref.current) return
        const atBottom = ref.current.scrollHeight - ref.current.clientHeight - ref.current.scrollTop <= 20
        if (!atBottom) setShouldScrollToBottom(false)
    }

    useEffect(() => {
        if (chatUUID) {
            getMessages(chatUUID).then(response => {
                if (response.ok) {
                    response.json().then(data => setMessages(data))
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
            className="flex flex-col size-full px-5 items-center overflow-y-auto"
            style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
            onScroll={handleScroll}
        >
            {messages.map(m => (
                <div key={m.id} className={`flex flex-col gap-0.5 w-[60vw] justify-self-center ${m.is_from_user ? "items-end" : "items-start"}`}>
                    {m.is_from_user ? (
                        <UserMessage text={m.text} isDisabled={false} onEditClick={() => { }} />
                    ) : (
                        <BotMessage
                            text={m.text}
                            model={m.model}
                            isRegenerateButtonDisabled={false}
                            onRegenerateSelect={() => { }}
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

function MessageButton({ trigger, tooltip, onClick, isDisabled = false }: {
    trigger: ReactNode
    tooltip: ReactNode
    onClick: () => void
    isDisabled?: boolean
}) {
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger
                    className={`p-2 rounded-lg hover:bg-gray-700 light:hover:bg-gray-300 ${isDisabled ? "opacity-50" : "cursor-pointer"}`}
                    onClick={onClick}
                    disabled={isDisabled}
                >
                    {trigger}
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

function CopyButton({ text }: { text: string }) {
    const [isChecked, setIsChecked] = useState(false)

    return (
        <MessageButton
            trigger={isChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
            tooltip="Copy"
            onClick={() => {
                navigator.clipboard.writeText(text)
                setIsChecked(true)
                setTimeout(() => setIsChecked(false), 2000)
            }}
        />
    )
}

function EditButton({ isDisabled, onClick }: { isDisabled: boolean, onClick: () => void }) {
    return (
        <MessageButton
            trigger={<Pencil1Icon className="size-4.5" />}
            tooltip="edit"
            onClick={onClick}
            isDisabled={isDisabled}
        />
    )
}

function RegenerateButton({ model, isDisabled, onSelect }: { model?: Model, isDisabled: boolean, onSelect: () => void }) {
    return (
        <Tooltip.Provider delayDuration={200}>
            <DropdownMenu.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <DropdownMenu.Trigger
                            className={`p-2 rounded-lg hover:bg-gray-700 light:hover:bg-gray-300 ${isDisabled ? "opacity-50" : "cursor-pointer"}`}
                            disabled={isDisabled}
                            data-testid="regenerate"
                        >
                            <UpdateIcon className="size-4.5" />
                        </DropdownMenu.Trigger>
                    </Tooltip.Trigger>

                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-white text-sm bg-black px-2 py-1 rounded-xl"
                            side="bottom"
                            sideOffset={3}
                        >
                            <div className="flex flex-col items-center">
                                <p>Regenerate</p>
                                {model && <p className="text-xs text-gray-400">Used {model}</p>}
                            </div>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className="flex flex-col gap-1 p-2 rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200" sideOffset={5}>
                        {["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"].map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={`
                                    flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600
                                    light:hover:bg-gray-400/50 ${m === model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                                `}
                                onSelect={onSelect}
                                data-testid="regenerate-dropdown-entry"
                            >
                                {m}
                                {m === model && <CheckIcon className="size-5" />}
                            </DropdownMenu.Item>
                        ))}
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </Tooltip.Provider>
    )
}

function UserMessage({ text, isDisabled, onEditClick }: { text: string, isDisabled: boolean, onEditClick: () => void }) {
    return (
        <>
            <div className="flex flex-col gap-1 min-w-20 max-w-[80%] px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300">
                {text}
            </div>

            <div className="flex gap-1">
                <EditButton isDisabled={isDisabled} onClick={onEditClick} />
                <CopyButton text={text} />
            </div>
        </>
    )
}

function BotMessage({ text, model, isRegenerateButtonDisabled, onRegenerateSelect }: {
    text: string,
    model?: Model,
    isRegenerateButtonDisabled: boolean
    onRegenerateSelect: () => void
}) {
    return (
        <>
            <div className="w-full whitespace-pre-wrap">
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

            <div className="flex gap-1">
                <CopyButton text={text} />
                <RegenerateButton model={model} isDisabled={isRegenerateButtonDisabled} onSelect={onRegenerateSelect} />
            </div>
        </>
    )
}