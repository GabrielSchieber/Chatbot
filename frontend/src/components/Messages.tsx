import { BoxModelIcon, CheckIcon, CopyIcon, Cross1Icon, Pencil1Icon, PlusIcon, UpdateIcon } from "@radix-ui/react-icons"
import React, { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import { useParams } from "react-router"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import { editMessage, getMessages, regenerateMessage } from "../utils/api"
import type { Message, MessageFile, Model } from "../types"
import { DropdownMenu, Tooltip } from "radix-ui"
import { Attachment, MAX_FILE_SIZE, MAX_FILES } from "./Chat"
import { getFileSize } from "../utils/file"

export default function Messages({ messages, setMessages }: {
    messages: Message[]
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
    const { chatUUID } = useParams()

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
            {messages.map((m, i) => (
                <div key={m.id} className={`flex flex-col gap-0.5 w-[60vw] justify-self-center ${m.is_from_user ? "items-end" : "items-start"}`}>
                    {editingMessageIndex === i ? (
                        <MessageEditor index={editingMessageIndex} setIndex={setEditingMessageIndex} messages={messages} setMessages={setMessages} />
                    ) : (
                        m.is_from_user ? (
                            <UserMessage text={m.text} files={m.files} isDisabled={false} onEditClick={() => setEditingMessageIndex(i)} />
                        ) : (
                            <BotMessage index={i} text={m.text} model={m.model} setMessages={setMessages} isRegenerateButtonDisabled={false} />
                        )
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
            tooltip="Edit"
            onClick={onClick}
            isDisabled={isDisabled}
        />
    )
}

function RegenerateButton({ index, model, setMessages, isDisabled }: {
    index: number
    model?: Model
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    isDisabled: boolean
}) {
    const { chatUUID } = useParams()

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
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={`
                                    flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600
                                    light:hover:bg-gray-400/50 ${m === model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                                `}
                                onSelect={_ => regenerate(m)}
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

function Attachments({ files, onRemove, onRemoveAll }: { files: MessageFile[], onRemove: (file: MessageFile) => void, onRemoveAll: () => void }) {
    return (
        <div className="relative flex flex-col gap-2 items-start">
            {files.map(f => (
                <Attachment key={f.id} file={f} onRemove={() => onRemove(f)} />
            ))}
            <button className="absolute right-0 p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={onRemoveAll}>
                <Cross1Icon className="size-3.5" />
            </button>
        </div>
    )
}

function TextArea({ text, setText }: {
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
}) {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        const textArea = textAreaRef.current
        if (!textArea) return
        textArea.style.height = "auto"
        textArea.style.height = `${textArea.scrollHeight}px`
    }, [text])

    return (
        <div className="flex">
            <textarea
                ref={textAreaRef}
                className="flex-1 px-2 content-center resize-none outline-none"
                placeholder="Type your message here..."
                value={text}
                onChange={e => setText(e.target.value)}
                autoFocus
            />
        </div>
    )
}

function Button({ icon, onClick }: { icon: ReactNode, onClick?: () => void }) {
    return (
        <button
            className="my-2 p-1 rounded-3xl cursor-pointer hover:bg-gray-600 light:bg-gray-400"
            onClick={onClick}
        >
            {icon}
        </button>
    )
}

function Dropdown({ icon, model, setModel }: {
    icon: ReactNode
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
}) {
    function Item({ m }: { m: Model }) {
        return (
            <DropdownMenu.Item
                className="p-2 rounded-md cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"
                onClick={_ => setModel(m)}
            >
                <div className="flex gap-2 items-center">
                    {m}{m === model && <CheckIcon className="size-5" />}
                </div>
            </DropdownMenu.Item>
        )
    }

    const models: Model[] = ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className="p-1 rounded-md cursor-pointer hover:bg-gray-600 light:bg-gray-400">
                {icon}
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-1 rounded-md bg-gray-800 light:bg-gray-200">
                {models.map(m => (
                    <Item key={m} m={m} />
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}


function MessageEditor({ index, setIndex, messages, setMessages }: {
    index: number
    setIndex: React.Dispatch<React.SetStateAction<number>>
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
    const { chatUUID } = useParams()

    const message = messages[index]

    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [text, setText] = useState(message.text)
    const [model, setModel] = useState<Model>(messages[index + 1].model || "SmolLM2-135M")

    const [addedFiles, setAddedFiles] = useState<File[]>([])
    const [removedFiles, setRemovedFiles] = useState<MessageFile[]>([])

    function edit(index: number) {
        if (chatUUID) {
            editMessage(chatUUID, text, index, model, addedFiles, removedFiles.map(f => f.id)).then(response => {
                if (response.ok) {
                    let shouldSetMessages = true
                    setMessages(previous => {
                        if (shouldSetMessages) {
                            const previousMessages = [...previous]

                            previousMessages[index].text = text

                            for (const removedFileID of removedFiles.map(f => f.id)) {
                                previousMessages[index].files = previousMessages[index].files.filter(file => file.id !== removedFileID)
                            }

                            let highestID = 1
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

                    setIndex(-1)
                    setText("")
                    setAddedFiles([])
                    setRemovedFiles([])
                } else {
                    alert("Edition of message was not possible")
                }
            })
        } else {
            alert("You must be in a chat to edit a message")
        }
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files) return

        if (getCurrentFiles().length + event.target.files.length > MAX_FILES) {
            alert(`You can only attach up to ${MAX_FILES} files at a time.`)
            event.target.value = ""
            return
        }

        const newFiles = Array.from(event.target.files)

        const visibleTotal = getCurrentFiles().map(f => f.content_size).reduce((a, b) => a + b, 0)
        const removedTotal = removedFiles.map(r => r.content_size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)
        const totalSize = visibleTotal - removedTotal + newTotal

        if (totalSize > MAX_FILE_SIZE) {
            alert(`Total file size exceeds ${getFileSize(MAX_FILE_SIZE)} limit. Please select smaller files.`)
            event.target.value = ""
            return
        }

        const existingAddedKeys = new Set(addedFiles.map(f => f.name + "|" + f.size))
        const existingVisibleKeys = new Set(getCurrentFiles().map(f => f.name + "|" + f.content_size))

        const highestVisibleFileID = getCurrentFiles().map(f => f.id).sort((a, b) => a - b).at(-1) || 1

        let syntheticCounter = 0
        const toAddUI: MessageFile[] = []
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
                toAddUI.push(original)
                existingVisibleKeys.add(key)
                continue
            }

            syntheticCounter += 1
            const id = highestVisibleFileID + syntheticCounter

            toAddFiles.push([id, f])
            toAddUI.push({ id, name: f.name, content_size: f.size, content_type: f.type })
        }

        if (toAddFiles.length > 0) {
            setAddedFiles(prev => [...prev, ...toAddFiles.map(([_, f]) => f)])
        }

        event.target.value = ""
    }

    function removeFile(file: MessageFile) {
        const currentFile = getCurrentFiles().find(f => f.id === file.id && f.name === file.name && f.content_size === file.content_size)
        const addedFilesKeys = new Set(addedFiles.map(f => f.name + "|" + f.size))
        if (currentFile && !addedFilesKeys.has(currentFile.name + "|" + currentFile.content_size)) {
            setRemovedFiles(previous => previous.find(f => f.id === file.id) ? previous : [...previous, file])
        } else {
            setAddedFiles(previous => previous.filter(f => !(f.name === file.name && f.size === file.content_size)))
        }
    }

    function removeFiles() {
        setRemovedFiles(previous => {
            const existingIDs = new Set(previous.map(f => f.id))
            return [...previous, ...getCurrentFiles().filter(f => !existingIDs.has(f.id))]
        })
        setAddedFiles(previous => previous.filter(added => !getCurrentFiles().some(f => f.name === added.name && f.content_size === added.size)))
    }

    function getCurrentFiles() {
        const highestFileID = messages.flatMap(m => m.files).map(f => f.id).sort().at(-1) || 1
        const current = message.files.filter(f => !(new Set(removedFiles.map(f => f.id)).has(f.id)))
        const added: MessageFile[] = addedFiles.map((f, i) => ({ id: highestFileID + i + 1, name: f.name, content_size: f.size, content_type: f.type }))
        return [...current, ...added]
    }

    return (
        <div className="flex flex-col gap-1 w-[80%] max-h-100 px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300">
            <div className="flex flex-col overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                {getCurrentFiles().length > 0 &&
                    <Attachments files={getCurrentFiles()} onRemove={removeFile} onRemoveAll={removeFiles} />
                }
                <TextArea text={text} setText={setText} />
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: "none" }}
                multiple
            />

            <div className="flex items-center justify-between">
                <div className="flex gap-1 items-center">
                    <Button icon={<PlusIcon className="size-6" />} onClick={() => fileInputRef.current?.click()} />
                    <Dropdown icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
                </div>
                <div className="flex gap-1 items-center">
                    <button
                        className="
                            px-3 py-1 rounded-lg cursor-pointer bg-gray-800
                            hover:bg-gray-800/60 light:bg-gray-200 light:hover:bg-gray-200/60
                        "
                        onClick={_ => {
                            setIndex(-1)
                            setText("")
                            setAddedFiles([])
                            setRemovedFiles([])
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        className="
                            px-3 py-1 rounded-lg cursor-pointer text-black light:text-white bg-gray-100 hover:bg-gray-200
                            light:bg-gray-900 light:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                        "
                        onClick={_ => edit(index)}
                        disabled={text.trim() === "" && getCurrentFiles().length === 0}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}

function UserMessage({ text, files, isDisabled, onEditClick }: { text: string, files: MessageFile[], isDisabled: boolean, onEditClick: () => void }) {
    return (
        <>
            <div
                className="flex flex-col gap-1 min-w-20 max-w-[80%] px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300"
                style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
            >
                <div className="flex flex-col gap-2 items-start">
                    {files.map(f => (
                        <Attachment key={f.id} file={f} />
                    ))}
                </div>
                <div className="w-full whitespace-pre-wrap">
                    {text}
                </div>
            </div>

            <div className="flex gap-1">
                <EditButton isDisabled={isDisabled} onClick={onEditClick} />
                <CopyButton text={text} />
            </div>
        </>
    )
}

function BotMessage({ index, text, model, isRegenerateButtonDisabled, setMessages }: {
    index: number,
    text: string,
    model?: Model,
    isRegenerateButtonDisabled: boolean
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
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
                <RegenerateButton index={index} model={model} setMessages={setMessages} isDisabled={isRegenerateButtonDisabled} />
            </div>
        </>
    )
}