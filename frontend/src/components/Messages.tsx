import { CheckIcon, CopyIcon, Cross2Icon, FileIcon, Pencil1Icon, UpdateIcon, UploadIcon } from "@radix-ui/react-icons"
import { DropdownMenu, Tooltip } from "radix-ui"
import React, { type JSX, type ReactElement, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

import { getMessage, getMessages, editMessage as editMessageAPI, regenerateMessage as regenerateMessageAPI, getPendingChats, getMessageFileContent } from "../utils/api"
import { getFileSize, getFileType } from "../utils/file"
import type { Chat, Message, MessageFile, Model, Options, UIAttachment } from "../types"
import { MAX_FILE_SIZE, MAX_FILES } from "./Chat"

export default function Messages({ messages, setMessages, pendingChat, setPendingChat, model, setModel, options }: {
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    pendingChat: Chat | undefined
    setPendingChat: React.Dispatch<React.SetStateAction<Chat | undefined>>
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
    options: Options
}) {
    const { chatUUID } = useParams()

    const webSocket = useRef<WebSocket>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const regenerateModel = useRef<Model | null>(null)
    const shouldLoadMessages = useRef(true)

    const [copiedMessageIndex, setCopiedMessageIndex] = useState(-1)
    const [editingMessageIndex, setEditingMessageIndex] = useState(-1)
    const [editingMessageText, setEditingMessageText] = useState("")

    const [addedFiles, setAddedFiles] = useState<File[]>([])
    const [removedFiles, setRemovedFiles] = useState<MessageFile[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])
    const [isRemovingFiles, setIsRemovingFiles] = useState(false)

    const isFetchingFileContents = useRef<Set<number>>(new Set())
    const [messagesFileContents, setMessagesFileContents] = useState<Map<number, Blob>>(new Map())

    function MessageButton({ children, onClick, tooltip, isDisabled = false, testID }: {
        children: ReactNode, onClick: () => void, tooltip: ReactNode, isDisabled?: boolean, testID?: string
    }) {
        return (
            <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                    <Tooltip.Trigger
                        className={`p-2 rounded-lg hover:bg-gray-700 light:hover:bg-gray-300 ${isDisabled ? "opacity-50" : "cursor-pointer"}`}
                        onClick={onClick}
                        disabled={isDisabled}
                        data-testid={testID}
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
                testID="copy"
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
                    setVisibleFiles(message.files.map(file => ({
                        messageFile: { id: file.id, name: file.name, content_size: file.content_size, content_type: file.content_type },
                        isBeingRemoved: false,
                        isNew: false
                    })))
                }}
                isDisabled={pendingChat !== undefined}
                testID="edit"
            />
        )
    }

    function RegenerateButton({ message, index }: { message: Message, index: number }) {
        const models: Model[] = ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]
        const isDisabled = pendingChat !== undefined

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
                                    {message.model && (
                                        <p className="text-xs text-gray-400">Used {message.model}</p>
                                    )}
                                </div>
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="flex flex-col gap-1 p-2 rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200" sideOffset={5}>
                            {models.map(m => (
                                <DropdownMenu.Item
                                    key={m}
                                    className={`
                                        flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600
                                        light:hover:bg-gray-400/50 ${m === message.model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                                    `}
                                    onSelect={_ => {
                                        regenerateModel.current = m
                                        regenerateMessage(index)
                                    }}
                                >
                                    {m}
                                    {m === message.model && <CheckIcon className="size-5" />}
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </Tooltip.Provider>
        )
    }

    const getFileContent = useCallback((id: number) => {
        const existing = messagesFileContents.get(id)
        if (existing) return existing

        if (isFetchingFileContents.current.has(id)) return

        if (!chatUUID) return

        isFetchingFileContents.current.add(id)
        getMessageFileContent(chatUUID, id)
            .then(response => {
                if (!response.ok) throw new Error("fetch failed")
                return response.blob()
            })
            .then(blob => {
                setMessagesFileContents(prev => {
                    const m = new Map(prev)
                    m.set(id, blob)
                    return m
                })
            })
            .finally(() => {
                isFetchingFileContents.current.delete(id)
            })
    }, [chatUUID, messagesFileContents])

    function AttachmentsInfo(files: MessageFile[]) {
        function getTotalSize(messageFiles: MessageFile[]): number {
            return messageFiles.map(file => file.content_size).reduce((total, size) => total + size)
        }

        return (
            <div className="flex gap-1">
                <p className="text-sm px-2 rounded bg-gray-600">Files: {files.length}/{MAX_FILES}</p>
                <p className="text-sm px-2 rounded bg-gray-600">Size: {getFileSize(getTotalSize(files))} / {getFileSize(MAX_FILE_SIZE)}</p>
            </div>
        )
    }

    function Attachments() {
        function removeFile(messageFile: MessageFile) {
            setVisibleFiles(prev => {
                const ui = prev.find(u => u.messageFile.id === messageFile.id && u.messageFile.name === messageFile.name && u.messageFile.content_size === messageFile.content_size)
                if (ui && !ui.isNew) {
                    setRemovedFiles(prevRemoved => {
                        if (prevRemoved.find(r => r.id === messageFile.id)) return prevRemoved
                        return [...prevRemoved, messageFile]
                    })
                } else {
                    setAddedFiles(prevAdded => prevAdded.filter(f => !(f.name === messageFile.name && f.size === messageFile.content_size)))
                }

                return prev.map(u => u.messageFile.id === messageFile.id ? { ...u, isBeingRemoved: true } : u)
            })

            setTimeout(() => {
                setVisibleFiles(prev => prev.filter(u => !(u.messageFile.id === messageFile.id && u.messageFile.name === messageFile.name && u.messageFile.content_size === messageFile.content_size)))
            }, 300)
        }

        function removeFiles() {
            setIsRemovingFiles(true)

            setRemovedFiles(prevRemoved => {
                const originals = visibleFiles.filter(u => !u.isNew).map(u => u.messageFile)
                const existingIDs = new Set(prevRemoved.map(r => r.id))
                return [...prevRemoved, ...originals.filter(o => !existingIDs.has(o.id))]
            })

            setAddedFiles(prevAdded => {
                const remaining = prevAdded.filter(added => !visibleFiles.some(u => u.isNew && u.messageFile.name === added.name && u.messageFile.content_size === added.size))
                return remaining
            })

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
                style={{ maxHeight: isRemovingFiles ? 0 : visibleFiles.length * 120 }}
                onClick={e => e.stopPropagation()}
            >
                {visibleFiles.map(file => (
                    <div
                        key={file.messageFile.id + "|" + file.messageFile.name + "|" + file.messageFile.content_size}
                        className={`
                            relative flex gap-1 p-2 w-fit items-center bg-gray-800/50 rounded-xl
                            transition-all duration-300 ${file.isBeingRemoved ? "opacity-0 translate-x-10" : "opacity-100"}
                        `}
                    >
                        <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                            <p className="px-2 py-1 rounded-lg bg-gray-800">
                                Type: {getFileType(file.messageFile.name)}<br />
                                Name: {file.messageFile.name}<br />
                                Size: {getFileSize(file.messageFile.content_size)}
                            </p>
                        </div>
                        <button
                            className="absolute top-0 right-0 translate-x-2 -translate-y-2 cursor-pointer text-red-400 hover:text-red-500"
                            onClick={_ => removeFile(file.messageFile)}
                        >
                            <Cross2Icon className="size-4" />
                        </button>
                    </div>
                ))}
                {AttachmentsInfo(visibleFiles.map(file => file.messageFile))}
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
                            previousMessages[message_index] = {
                                text: previousMessages[message_index].text + data.token, files: [], is_from_user: false, model: regenerateModel.current || model
                            }
                        }
                        return previousMessages
                    })
                } else if (data.message) {
                    setMessages(previous => {
                        let previousMessages = [...previous]
                        if (previousMessages[message_index]) {
                            previousMessages[message_index] = { text: data.message, files: [], is_from_user: false, model: regenerateModel.current || model }
                        }
                        return previousMessages
                    })
                    setPendingChat(undefined)
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
        if (message.is_from_user) {
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
            editMessageAPI(chatUUID, model, options, editingMessageText, index, addedFiles, removedFiles.map(file => file.id)).then(([chat, status]) => {
                if (status === 200) {
                    let shouldSetMessages = true
                    setMessages(previous => {
                        if (shouldSetMessages) {
                            const previousMessages = [...previous]

                            previousMessages[index].text = editingMessageText

                            for (const removedFileID of removedFiles.map(file => file.id)) {
                                previousMessages[index].files = previousMessages[index].files.filter(file => file.id !== removedFileID)
                            }

                            let highestID = 0
                            for (const file of previousMessages[index].files) {
                                if (file.id > highestID) {
                                    highestID = file.id
                                }
                            }

                            previousMessages[index].files = [
                                ...previousMessages[index].files,
                                ...addedFiles.map((file, index) => ({
                                    id: highestID + index + 1,
                                    name: file.name,
                                    content_size: file.size,
                                    content_type: file.type
                                }))]

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
        if (chatUUID && regenerateModel.current) {
            regenerateMessageAPI(chatUUID, regenerateModel.current, options, index).then(([chat, status]) => {
                if (status === 200) {
                    setMessages(previous => {
                        const previousMessages = [...previous]
                        previousMessages[index].text = ""
                        if (regenerateModel.current) {
                            previousMessages[index].model = regenerateModel.current
                        }
                        return previousMessages
                    })
                    chat.then(chat => setPendingChat(chat))
                }
            })
        } else {
            alert("Regeneration of message was not possible")
        }
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files) return

        if (visibleFiles.length + event.target.files.length > MAX_FILES) {
            alert(`You can only attach up to ${MAX_FILES} files at a time.`)
            event.target.value = ""
            return
        }

        const newFiles = Array.from(event.target.files)

        const visibleTotal = visibleFiles.map(v => v.messageFile.content_size).reduce((a, b) => a + b, 0)
        const removedTotal = removedFiles.map(r => r.content_size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)
        const totalSize = visibleTotal - removedTotal + newTotal

        if (totalSize > MAX_FILE_SIZE) {
            alert(`Total file size exceeds ${getFileSize(MAX_FILE_SIZE)} limit. Please select smaller files.`)
            event.target.value = ""
            return
        }

        const existingAddedKeys = new Set(addedFiles.map(f => f.name + "|" + f.size))
        const existingVisibleKeys = new Set(visibleFiles.map(u => u.messageFile.name + "|" + u.messageFile.content_size))

        const highestVisibleFileID = visibleFiles.map(file => file.messageFile.id).sort((a, b) => a - b).at(-1) || 1

        let syntheticCounter = 0
        const toAddUI: UIAttachment[] = []
        const toAddFiles: [number, File][] = []

        for (const f of newFiles) {
            const key = f.name + "|" + f.size

            if (existingAddedKeys.has(key) || existingVisibleKeys.has(key)) {
                continue
            }

            const removedIndex = removedFiles.findIndex(r => r.name === f.name && r.content_size === f.size)
            if (removedIndex !== -1) {
                const original = removedFiles[removedIndex]
                setRemovedFiles(prev => prev.filter((_, i) => i !== removedIndex))
                toAddUI.push({ messageFile: original, isBeingRemoved: false, isNew: false })
                existingVisibleKeys.add(key)
                continue
            }

            syntheticCounter += 1
            const id = highestVisibleFileID + syntheticCounter

            toAddFiles.push([id, f])
            toAddUI.push({
                messageFile: { id, name: f.name, content_size: f.size, content_type: f.type },
                isBeingRemoved: false,
                isNew: true
            })
        }

        if (toAddFiles.length > 0) {
            setAddedFiles(prev => [...prev, ...toAddFiles.map(([_, f]) => f)])
            setMessagesFileContents(previous => {
                const previousContents = new Map(previous)
                for (const [id, file] of toAddFiles) {
                    previousContents.set(id, file)
                }
                return previousContents
            })
        }
        if (toAddUI.length > 0) {
            setVisibleFiles(prev => [...prev, ...toAddUI])
        }

        event.target.value = ""
    }

    useEffect(() => {
        loadMessages()
        getPendingChats().then(chats => {
            chats.length > 0 ? setPendingChat(chats[0]) : setPendingChat(undefined)
            receiveMessage()
        })
    }, [])

    useEffect(() => {
        if (regenerateModel.current) {
            setModel(regenerateModel.current)
        }
    }, [regenerateModel.current])

    return (
        <div className="flex flex-col gap-2 pt-10 pb-25 items-center overflow-y-auto">
            {messages.map((message, index) => (
                <div key={index} className={`flex flex-col gap-0.5 w-[50vw] justify-self-center ${message.is_from_user ? "items-end" : "items-start"}`}>
                    {editingMessageIndex === index ? (
                        <div className="flex flex-col gap-1 w-[80%] max-h-100 px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300">
                            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                                {visibleFiles.length > 0 && Attachments()}
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
                                            setAddedFiles([])
                                            setRemovedFiles([])
                                            setVisibleFiles(message.files.map(file => ({
                                                messageFile: { id: file.id, name: file.name, content_size: file.content_size, content_type: file.content_type },
                                                isBeingRemoved: false,
                                                isNew: false
                                            })))
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
                                        disabled={editingMessageText.trim() === "" && visibleFiles.length === 0 && pendingChat === undefined}
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        message.is_from_user ? (
                            <UserMessage text={message.text} index={index} files={message.files} getFileContent={getFileContent} AttachmentsInfo={AttachmentsInfo} />
                        ) : (
                            <div className="w-full whitespace-pre-wrap" data-testid={`message-${index}`}>
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
                        {message.is_from_user ? (
                            <>
                                <EditButton message={message} index={index} />
                                <CopyButton message={message} index={index} />
                            </>
                        ) : (
                            <>
                                <CopyButton message={message} index={index} />
                                <RegenerateButton message={message} index={index} />
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

const FileItemIcon = React.memo(function FileItemIcon({
    file,
    getFileContent
}: {
    file: MessageFile
    getFileContent: (id: number) => Blob | undefined
}) {
    if (getFileType(file.name) !== "Image") {
        return <FileIcon className="size-14 bg-gray-800 p-2 rounded-lg" />
    }

    const content = getFileContent(file.id)
    const [objectUrl, setObjectUrl] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!content) {
            setObjectUrl(prev => {
                if (prev) URL.revokeObjectURL(prev)
                return null
            })
            return
        }

        const url = URL.createObjectURL(content)
        setObjectUrl(prev => {
            if (prev && prev !== url) URL.revokeObjectURL(prev)
            return url
        })

        return () => {
            URL.revokeObjectURL(url)
        }
    }, [content])

    return objectUrl ? (
        <img src={objectUrl} alt={file.name} className="size-14 object-cover rounded-lg" />
    ) : (
        <div className="flex p-2 rounded-lg bg-gray-800">
            <svg className="size-12 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
        </div>
    )
})

function FileItem({ file, getFileContent }: { file: MessageFile, getFileContent: (id: number) => Blob | undefined }) {
    return (
        <div className="relative flex gap-1 p-2 w-fit items-center bg-gray-800/50 rounded-xl">
            {<FileItemIcon file={file} getFileContent={getFileContent} />}
            <p className="h-full content-center px-2 py-1 text-[12px] font-semibold rounded-lg bg-gray-800">
                Type: {getFileType(file.name)}<br />
                Name: {file.name}<br />
                Size: {getFileSize(file.content_size)}
            </p>
        </div>
    )
}

const UserMessage = React.memo(function UserMessage({
    text, index, files, getFileContent, AttachmentsInfo
}: {
    text: string
    index: number
    files: MessageFile[]
    getFileContent: (id: number) => Blob | undefined
    AttachmentsInfo: (files: MessageFile[]) => JSX.Element
}) {
    return (
        <div className="flex flex-col gap-1 min-w-20 max-w-[80%] px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300" data-testid={`message-${index}`}>
            {files.length > 0 && (
                <div className="flex flex-col gap-1 p-2 rounded-xl border border-gray-500">
                    {files.map(file => (
                        <FileItem key={file.id + "|" + file.name + "|" + file.content_size} file={file} getFileContent={getFileContent} />
                    ))}
                    {AttachmentsInfo(files)}
                </div>
            )}
            <div className="whitespace-pre-wrap">
                {text}
            </div>
        </div>
    )
})