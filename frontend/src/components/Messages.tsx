import { CheckIcon, CopyIcon, Cross2Icon, FileIcon, Pencil1Icon, UpdateIcon, UploadIcon } from "@radix-ui/react-icons"
import { Tooltip } from "radix-ui"
import React, { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import { getChats, getMessage, getMessages, editMessage as editMessageAPI, renegerateMessage as regenerateMessageAPI } from "../utils/api"
import { getFileSize, getFileType } from "../utils/file"
import type { Chat, Message, MessageFile, Model, UIAttachment } from "../types"

export default function Messages({ messages, setMessages, pendingChat, setPendingChat, model, setModel }: {
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    pendingChat: Chat | undefined
    setPendingChat: React.Dispatch<React.SetStateAction<Chat | undefined>>
    model: Model | undefined
    setModel: React.Dispatch<React.SetStateAction<Model>>
}) {
    const { chatUUID } = useParams()

    const webSocket = useRef<WebSocket>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const shouldLoadMessages = useRef(true)

    const [copiedMessageIndex, setCopiedMessageIndex] = useState(-1)
    const [editingMessageIndex, setEditingMessageIndex] = useState(-1)
    const [editingMessageText, setEditingMessageText] = useState("")

    const [addedFiles, setAddedFiles] = useState<File[]>([])
    const [removedFiles, setRemovedFiles] = useState<MessageFile[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])
    const [isRemovingFiles, setIsRemovingFiles] = useState(false)

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
                    setVisibleFiles(message.files.map(f => {
                        return {
                            message_file: { id: f.id, name: f.name, content_size: f.content_size, content_type: f.content_type },
                            isRemoving: false
                        }
                    }))
                }}
                isDisabled={pendingChat !== undefined}
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

    function Attachments(message_index: number) {
        function removeFile(file: MessageFile) {
            setVisibleFiles(previous =>
                previous.map(f => f.message_file.id === file.id ? { ...f, isRemoving: true } : f)
            )
            setRemovedFiles(previous => [...previous, file])

            setTimeout(() => {
                setVisibleFiles(previous => previous.filter(f => f.message_file.id !== file.id))
                setMessages(previous => {
                    let messages = [...previous]
                    messages[message_index].files = previous[message_index].files.filter(f => f.id !== file.id)
                    return messages
                })
            }, 300)
        }

        function removeFiles() {
            setIsRemovingFiles(true)
            setTimeout(() => {
                setVisibleFiles([])
                setIsRemovingFiles(false)
            }, 300)
        }

        return (
            <div
                className={`
                    relative flex flex-col gap-1 p-2 border border-gray-500 top-0 rounded-xl
                    transition-all duration-300 ${isRemovingFiles ? "opacity-0 overflow-y-hidden" : "opacity-100"}
                `}
                style={{
                    maxHeight: isRemovingFiles ? 0 : visibleFiles.length * 100
                }}
                onClick={e => e.stopPropagation()}
            >
                {visibleFiles.map(file => (
                    <div
                        key={file.message_file.name}
                        className={`
                            relative flex gap-1 p-2 w-fit items-center bg-gray-800/50 rounded-xl
                            transition-all duration-300 ${file.isRemoving ? "opacity-0 translate-x-10" : "opacity-100"}
                        `}
                    >
                        <FileIcon className="size-14 bg-gray-800 p-2 rounded-lg" />
                        <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                            <p className="px-2 py-1 rounded-lg bg-gray-800">
                                Type: {getFileType(file.message_file.name)}<br />
                                Name: {file.message_file.name}<br />
                                Size: {getFileSize(file.message_file.content_size)}
                            </p>
                        </div>
                        <button
                            className="absolute top-0 right-0 translate-x-2 -translate-y-2 cursor-pointer text-red-400 hover:text-red-500"
                            onClick={_ => removeFile(file.message_file)}
                        >
                            <Cross2Icon className="size-4" />
                        </button>
                    </div>
                ))}
                <button
                    className="absolute right-0 -translate-x-2 cursor-pointer text-red-400 hover:text-red-500"
                    onClick={removeFiles}
                >
                    <Cross2Icon />
                </button>
            </div>
        )
    }

    function loadMessages() {
        if (shouldLoadMessages.current && chatUUID) {
            shouldLoadMessages.current = false
            getMessages(chatUUID).then(messages => {
                if (messages) {
                    setMessages(messages)
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1]
                        if (lastMessage.model) {
                            setModel(lastMessage.model)
                        }
                    }
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
                            previousMessages[message_index] = { text: previousMessages[message_index].text + data.token, files: [], role: "Bot", model: model }
                        }
                        return previousMessages
                    })
                } else if (data.message) {
                    setMessages(previous => {
                        let previousMessages = [...previous]
                        if (previousMessages[message_index]) {
                            previousMessages[message_index] = { text: data.message, files: [], role: "Bot", model: model }
                        }
                        return previousMessages
                    })
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
            editMessageAPI(chatUUID, "SmolLM2-135M", editingMessageText, index, addedFiles, removedFiles).then(([chat, status]) => {
                if (status === 200) {
                    let shouldSetMessages = true
                    setMessages(previous => {
                        if (shouldSetMessages) {
                            const previousMessages = [...previous]

                            previousMessages[index].text = editingMessageText
                            previousMessages[index].files = [
                                ...previousMessages[index].files,
                                ...addedFiles.map(f => {
                                    return {
                                        id: Date.now(),
                                        name: f.name,
                                        content_size: f.size,
                                        content_type: f.type
                                    }
                                })]

                            previousMessages[index + 1].text = ""

                            shouldSetMessages = false
                            return previousMessages
                        } else {
                            return previous
                        }
                    })

                    setEditingMessageIndex(-1)
                    setEditingMessageText("")
                    setAddedFiles([])
                    setRemovedFiles([])
                    setVisibleFiles([])

                    chat.then(chat => setPendingChat(chat))
                }
            })
        } else {
            alert("Edition of message was not possible")
        }
    }

    function regenerateMessage(index: number) {
        if (chatUUID) {
            regenerateMessageAPI(chatUUID, "SmolLM2-135M", index).then(([chat, status]) => {
                if (status === 200) {
                    setMessages(previous => {
                        const messages = [...previous]
                        messages[index].text = ""
                        return messages
                    })
                    chat.then(chat => setPendingChat(chat))
                }
            })
        } else {
            alert("Edition of message was not possible")
        }
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files) return

        if (event.target.files.length + addedFiles.length - removedFiles.length > 10) {
            alert("You can only attach up to 10 files at a time.")
            event.target.value = ""
            return
        }

        let totalSize = 0
        for (const addedFile of addedFiles) {
            totalSize += addedFile.size
        }
        for (const removedFile of removedFiles) {
            totalSize -= removedFile.content_size
        }
        for (const file of event.target.files) {
            totalSize += file.size
        }
        if (totalSize > 5_000_000) {
            alert("Total file size exceeds 5 MB limit. Please select smaller files.")
            event.target.value = ""
            return
        }

        const newFiles = Array.from(event.target.files)

        const existingKeys = new Set(addedFiles.map(f => f.name + "|" + f.size))
        const uniqueNew = newFiles.filter(f => !existingKeys.has(f.name + "|" + f.size))

        setAddedFiles(previous => [...previous, ...uniqueNew])

        setVisibleFiles(previous => [
            ...previous,
            ...uniqueNew.map(f => {
                return {
                    message_file: {
                        id: Date.now(),
                        name: f.name,
                        content_size: f.size,
                        content_type: f.type
                    },
                    isRemoving: false
                }
            })
        ])

        event.target.value = ""
    }

    useEffect(() => {
        loadMessages()
        receiveMessage()
        getChats(true).then(chats => chats.length > 0 ? setPendingChat(chats[0]) : setPendingChat(undefined))
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
                                {visibleFiles.length > 0 && Attachments(index)}
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
                            <div className="flex justify-between">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: "none" }}
                                    multiple
                                />

                                <button
                                    className="
                                        flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer bg-gray-800
                                        hover:bg-gray-800/60 light:bg-gray-200 light:hover:bg-gray-200/60
                                    "
                                    onClick={_ => fileInputRef.current?.click()}
                                >
                                    <UploadIcon /> Add files
                                </button>
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
                </div>
            ))}
        </div>
    )
}