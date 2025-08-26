import { ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, Cross2Icon, FileIcon, GearIcon, PauseIcon, PlusIcon, UploadIcon } from "@radix-ui/react-icons"
import { createChat, getChats, uploadFiles } from "../utils/api"
import { useEffect, useRef, useState, type ReactNode } from "react"
import type { Model, Message, UIAttachment, Chat } from "../types"
import { useParams } from "react-router"

export default function Prompt({ webSocket, setMessages, isAnyChatIncomplete, setIsAnyChatIncomplete }: {
    webSocket: React.RefObject<WebSocket | null>,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    isAnyChatIncomplete: boolean
    setIsAnyChatIncomplete: React.Dispatch<React.SetStateAction<boolean>>
}) {
    const { chatUUID } = useParams()
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [prompt, setPrompt] = useState("")
    const [model, setModel] = useState(() => localStorage.getItem("model") as Model || "SmolLM2-135M")
    const [currentFiles, setCurrentFiles] = useState<File[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])
    const [inProgressChat, setInProgressChat] = useState<Chat | null>(null)

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isDropdownOptionsOpen, setIsDropdownOptionsOpen] = useState(false)
    const [isDropdownModelOpen, setIsDropdownModelOpen] = useState(false)

    function getStoredOptions() {
        const storedOptions = localStorage.getItem("options")
        if (storedOptions) {
            return JSON.parse(storedOptions)
        } else {
            return {
                max_tokens: 256,
                temperature: 0.2,
                top_p: 0.9,
                seed: 0
            }
        }
    }

    const [options, setOptions] = useState<{
        max_tokens: number
        temperature: number
        top_p: number
        seed: number
    }>(() => getStoredOptions())

    function GeneratingMessageNotification({ title, uuid, }: { title: string, uuid: string }) {
        return (
            <div className="px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300">
                A message is already being generated in <a className="underline" href={`/chat/${uuid}`}>{title}</a>
            </div>
        )
    }

    function AddDropdown() {
        function OptionItem({ label, optionKey }: { label: ReactNode, optionKey: "max_tokens" | "temperature" | "top_p" | "seed" }) {
            const optionsClassNames = "flex items-center justify-between text-sm gap-1 px-1 rounded bg-gray-700"
            const optionsPClassNames = "truncate"
            const optionsInputClassNames = "w-15 px-1.5 m-1 outline-none rounded bg-gray-600 hover:bg-gray-500 focus:bg-gray-500"

            function handleSetOptions(value: string) {
                if (optionKey === "max_tokens" || optionKey === "seed") {
                    setOptions(previous => {
                        const previousOptions = { ...previous }
                        previousOptions[optionKey] = optionKey === "max_tokens" ? clamp(parseInt(value), 32, 4096) : parseInt(value)
                        return previousOptions
                    })
                } else {
                    setOptions(previous => {
                        const previousOptions = { ...previous }
                        previousOptions[optionKey] = clamp(parseFloat(value), 0.01, 10)
                        return previousOptions
                    })
                }
            }

            return (
                <div className={optionsClassNames}>
                    <p className={optionsPClassNames}>{label}</p>
                    <input
                        className={optionsInputClassNames}
                        defaultValue={options[optionKey]}
                        onBlur={e => handleSetOptions(e.currentTarget.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") {
                                handleSetOptions(e.currentTarget.value)
                            }
                        }}
                    />
                </div>
            )
        }

        function ModelItem({ modelName }: { modelName: "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" }) {
            return (
                <div className="flex gap-1 w-40 px-2 py-1 items-center justify-between rounded hover:bg-gray-700">
                    <button className="truncate cursor-pointer" onClick={_ => setModel(modelName)}>{modelName}</button>
                    {modelName == model && <CheckIcon className="size-5" />}
                </div>
            )
        }

        const buttonClassNames = "flex w-full px-1 gap-2 justify-between items-center cursor-pointer rounded hover:bg-gray-700"
        const dropdownClassNames = "absolute flex flex-col gap-1 p-2 rounded-xl bg-gray-800"

        return (
            <div className="relative flex flex-col" onClick={e => e.stopPropagation()}>
                <button className="p-1.5 rounded-3xl hover:bg-gray-600" tabIndex={2} onClick={_ => setIsDropdownOpen(!isDropdownOpen)}>
                    <PlusIcon className="size-6" />
                </button>
                {isDropdownOpen && (
                    <div className="absolute flex flex-col gap-1 p-2 self-center items-center cursor-auto bottom-10 rounded-xl bg-gray-800">
                        <button
                            className={buttonClassNames}
                            onClick={_ => {
                                setIsDropdownOptionsOpen(!isDropdownOptionsOpen)
                                setIsDropdownModelOpen(false)
                            }}
                        >
                            <GearIcon /> Options {isDropdownOptionsOpen ? <ChevronRightIcon /> : <ChevronDownIcon />}
                        </button>
                        {isDropdownOptionsOpen && (
                            <div className={dropdownClassNames + " bottom-10 left-32"}>
                                <OptionItem label="🔣 Max. Tokens" optionKey="max_tokens" />
                                <OptionItem label="🌡 Temperature" optionKey="temperature" />
                                <OptionItem
                                    label={
                                        <span className="flex items-center gap-1">
                                            <ArrowUpIcon /> Top P
                                        </span>
                                    }
                                    optionKey="top_p"
                                />
                                <OptionItem label="🌱 Seed" optionKey="seed" />
                            </div>
                        )}

                        <button
                            className={buttonClassNames}
                            onClick={_ => {
                                setIsDropdownModelOpen(!isDropdownModelOpen)
                                setIsDropdownOptionsOpen(false)
                            }}
                        >
                            <BoxModelIcon /> Model {isDropdownModelOpen ? <ChevronRightIcon /> : <ChevronDownIcon />}
                        </button>

                        {isDropdownModelOpen && (
                            <div className={dropdownClassNames + " bottom-0 left-32"}>
                                <ModelItem modelName="SmolLM2-135M" />
                                <ModelItem modelName="SmolLM2-360M" />
                                <ModelItem modelName="SmolLM2-1.7B" />
                            </div>
                        )}

                        <button
                            className={buttonClassNames + " justify-start"}
                            onClick={_ => {
                                handleFileClick()
                                setIsDropdownOpen(false)
                            }}>
                            <UploadIcon /> Add files
                        </button>
                    </div>
                )}
            </div>
        )
    }

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setPrompt(e.target.value)

        const textArea = textAreaRef.current
        if (textArea) {
            textArea.style.height = "auto"
            textArea.style.height = Math.min(textArea.scrollHeight, 300) + "px"
        }
    }

    function sendMessage() {
        getChats(true).then(async chats => {
            if (chats.length === 0) {
                if (!chatUUID) {
                    createChat().then(chat => {
                        if (webSocket.current) {
                            if (currentFiles.length > 0) {
                                uploadFiles(currentFiles).then(files => {
                                    if (!files.error && webSocket.current) {
                                        webSocket.current.send(JSON.stringify({ model: model, message: prompt, files: files, chat_uuid: chat.uuid, options: options }))
                                        setPrompt("")
                                        setCurrentFiles([])
                                        setVisibleFiles([])
                                        setIsAnyChatIncomplete(true)
                                        location.href = `/chat/${chat.uuid}`
                                    }
                                })
                            } else {
                                webSocket.current.send(JSON.stringify({ model: model, message: prompt, chat_uuid: chat.uuid, options: options }))
                                location.href = `/chat/${chat.uuid}`
                            }
                        }
                    })
                } else if (webSocket.current) {
                    setMessages(previous => {
                        const previousMessages = [...previous]
                        previousMessages.push({ "text": prompt, "files": [], "is_user_message": true })
                        previousMessages.push({ "text": "", "files": [], "is_user_message": false })
                        return previousMessages
                    })

                    if (currentFiles.length > 0) {
                        uploadFiles(currentFiles).then(files => {
                            if (!files.error && webSocket.current) {
                                webSocket.current.send(JSON.stringify({ model: model, message: prompt, files: files, options: options }))
                                setPrompt("")
                                setCurrentFiles([])
                                setVisibleFiles([])
                                setIsAnyChatIncomplete(true)
                            }
                        })
                    } else {
                        webSocket.current.send(JSON.stringify({ message: prompt, options: options }))
                        setPrompt("")
                        setIsAnyChatIncomplete(true)
                    }
                }
            } else {
                setInProgressChat(chats[0])
                setTimeout(() => setInProgressChat(null), 2000)
            }
        })
    }

    function sendMessageWithEvent(event: React.KeyboardEvent) {
        if (webSocket.current && event.key === "Enter" && !event.shiftKey && prompt.trim()) {
            event.preventDefault()
            sendMessage()
        }
    }

    function handleFileClick() {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        function getID() {
            return Math.random().toString(36).slice(2) + Date.now().toString(36)
        }

        if (!event.target.files) return

        if (event.target.files.length + currentFiles.length > 10) {
            alert("You can only attach up to 10 files at a time.")
            event.target.value = ""
            return
        }

        let totalSize = 0
        for (const file of currentFiles) {
            totalSize += file.size
        }
        for (const file of event.target.files) {
            totalSize += file.size
        }
        if (totalSize > 1_000_000) {
            alert("Total file size exceeds 1 MB limit. Please select smaller files.")
            event.target.value = ""
            return
        }

        const newFiles = Array.from(event.target.files)

        const existingKeys = new Set(currentFiles.map(f => f.name + "|" + f.size))
        const uniqueNew = newFiles.filter(f => !existingKeys.has(f.name + "|" + f.size))

        setCurrentFiles(previous => [...previous, ...uniqueNew])

        setVisibleFiles(previous => [
            ...previous,
            ...uniqueNew.map(f => ({ id: getID(), file: f, isRemoving: false }))
        ])

        event.target.value = ""
    }

    function removeFile(id: string) {
        setVisibleFiles(previous =>
            previous.map(f => f.id === id ? { ...f, isRemoving: true } : f)
        )

        setTimeout(() => {
            setVisibleFiles(previous => previous.filter(f => f.id !== id))
            setCurrentFiles(previous =>
                previous.filter(f => !visibleFiles.some(v => v.id === id && v.file === f))
            )
        }, 300)
    }

    function removeFiles() {
        setVisibleFiles(previous =>
            previous.map(f => { return { ...f, isRemoving: true } })
        )

        setTimeout(() => {
            setVisibleFiles([])
            setCurrentFiles([])
        }, 300)
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

    function handleStop() {
        getChats(true).then(chats => {
            if (chats.length > 0 && webSocket.current) {
                webSocket.current.send(JSON.stringify({ action: "stop_message" }))
                setIsAnyChatIncomplete(false)
            }
        })
    }

    function clamp(number: number, min: number, max: number) {
        return Math.max(Math.min(number, max), min)
    }

    useEffect(() => {
        localStorage.setItem("model", model)
    }, [model])

    useEffect(() => {
        localStorage.setItem("options", JSON.stringify(options))
    }, [options])

    return (
        <div className="absolute bottom-0 flex flex-col w-[50vw] pb-4 self-center">
            {inProgressChat && <GeneratingMessageNotification title={inProgressChat.title} uuid={inProgressChat.uuid} />}

            <div
                className={`
                    flex flex-col gap-1 p-2 rounded-xl bg-gray-800 shadow-xl transform transition-all duration-300 origin-bottom
                    ${visibleFiles.length > 0 ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none h-0 p-0"}
                `}
            >
                <button className="self-end text-red-400 hover:text-red-500" onClick={removeFiles}>
                    <Cross2Icon />
                </button>
                {visibleFiles.map(file => (
                    <div
                        key={file.id}
                        className={`
                            flex gap-1 px-2 items-center border rounded-xl border-gray-500 bg-gray-700
                            transition-all duration-300 ${file.isRemoving ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
                        `}
                    >
                        <FileIcon className="size-8 p-1 rounded-md bg-gray-900" />
                        <div className="w-full text-sm">
                            <div>{file.file.name}</div>
                            <div>{getFileType(file.file.name)}</div>
                        </div>
                        <button className="text-red-400 hover:text-red-500" onClick={_ => removeFile(file.id)}>
                            <Cross2Icon />
                        </button>
                    </div>
                ))}
            </div>

            <div
                className="
                    flex gap-2 w-full px-4 py-3 items-center rounded-[30px] cursor-text shadow-xl/50
                    border-t-4 border-gray-600 light:border-gray-400 bg-gray-700 light:bg-gray-300
                "
                onClick={e => {
                    if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                        return
                    }
                    textAreaRef.current?.focus()
                }}
            >
                <AddDropdown />

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    multiple
                />

                <textarea
                    className="flex-1 resize-none outline-none px-2"
                    value={prompt}
                    placeholder="Ask me anything..."
                    rows={1}
                    tabIndex={1}
                    ref={textAreaRef}
                    onChange={handleChange}
                    onKeyDown={sendMessageWithEvent}
                    style={{ maxHeight: "300px", overflowY: "auto" }}
                    autoFocus
                />

                {prompt.trim() && !isAnyChatIncomplete &&
                    <button
                        className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end"
                        tabIndex={3}
                        onClick={sendMessage}
                    >
                        <ArrowUpIcon className="size-6 text-white" />
                    </button>
                }

                {isAnyChatIncomplete &&
                    <button
                        className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end"
                        tabIndex={3}
                        onClick={handleStop}
                    >
                        <PauseIcon className="size-6 text-white" />
                    </button>
                }
            </div>
        </div>
    )
}