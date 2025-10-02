import { CheckIcon, CopyIcon, UpdateIcon } from "@radix-ui/react-icons"
import { DropdownMenu, Tooltip } from "radix-ui"
import React, { useState, type ReactElement } from "react"
import { useParams } from "react-router"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import { Copy } from "./Buttons"
import { useChat } from "../../../context/ChatProvider"
import { regenerateMessage } from "../../../utils/api"
import type { Model } from "../../../types"

export default function Bot({ index, text, model }: { index: number, text: string, model?: Model }) {
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
                <Copy text={text} />
                <Regenerate index={index} model={model} />
            </div>
        </>
    )
}

function Regenerate({ index, model }: { index: number, model?: Model }) {
    const { chatUUID } = useParams()

    const { setMessages, pendingChat, setPendingChat, isLoading } = useChat()

    function regenerate(model: Model) {
        if (chatUUID) {
            regenerateMessage(chatUUID, index, model).then(response => {
                if (response.ok) {
                    setMessages(previous => {
                        const previousMessages = [...previous]
                        previousMessages[index].text = ""
                        previousMessages[index].model = model
                        return previousMessages
                    })

                    response.json().then(chat => setPendingChat(chat))
                } else {
                    alert("Regeneration of message was not possible")
                }
            })
        } else {
            alert("You must be in a chat to regenerate a message")
        }
    }

    return (
        <Tooltip.Provider delayDuration={200}>
            <DropdownMenu.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <DropdownMenu.Trigger
                            className="p-2 rounded-lg hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={pendingChat !== null || isLoading}
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
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={`
                                        flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600
                                        light:hover:bg-gray-400/50 ${m === model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                                    `}
                                onSelect={_ => regenerate(m)}
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