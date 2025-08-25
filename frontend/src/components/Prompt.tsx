import { ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronRightIcon, Cross2Icon, FileIcon, PauseIcon, PlusIcon, UploadIcon } from "@radix-ui/react-icons"
import { createChat, getChats } from "../utils/api"
import { useEffect, useRef, useState } from "react"
import type { Model, Message, UIAttachment, Chat } from "../types"
import { DropdownMenu } from "radix-ui"
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

    function GeneratingMessageNotification({ title, uuid, }: { title: string, uuid: string }) {
        return (
            <div className="px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300">
                A message is already being generated in <a className="underline" href={`/chat/${uuid}`}>{title}</a>
            </div>
        )
    }

    function AddDropdown() {
        const buttonClassNames = `
            flex gap-2 px-2 py-1 items-center outline-none rounded cursor-pointer
            data-[highlighted]:bg-gray-600/60 light:data-[highlighted]:bg-gray-400/40
        `
        const itemClassNames = `
            flex w-40 justify-between items-center px-2 py-1 outline-none rounded cursor-pointer
            data-[highlighted]:bg-gray-600/60 light:data-[highlighted]:bg-gray-400/40
        `

        return (
            <DropdownMenu.Root>
                <DropdownMenu.Trigger tabIndex={2} id="add-dropdown-trigger" className="hover:bg-gray-600 light:hover:bg-gray-200 p-1.5 rounded-[20px] cursor-pointer self-end">
                    <PlusIcon className="size-6" />
                </DropdownMenu.Trigger>

                <DropdownMenu.Content className="flex flex-col bg-gray-700 light:bg-gray-300 p-2 rounded-xl translate-x-7 -translate-y-2 shadow-xl/30">
                    <DropdownMenu.Sub>
                        <DropdownMenu.SubTrigger className={buttonClassNames}>
                            <BoxModelIcon /> Model <ChevronRightIcon />
                        </DropdownMenu.SubTrigger>

                        <DropdownMenu.SubContent className="bg-gray-700 light:bg-gray-300 p-2 rounded-xl -translate-y-20 shadow-xl/30" sideOffset={5}>
                            <DropdownMenu.Item
                                className={itemClassNames}
                                onSelect={() => setModel("SmolLM2-135M")}
                            >
                                SmolLM2-135M
                                {model === "SmolLM2-135M" && <CheckIcon className="size-5" />}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className={itemClassNames}
                                onSelect={() => setModel("SmolLM2-360M")}
                            >
                                SmolLM2-360M
                                {model === "SmolLM2-360M" && <CheckIcon className="size-5" />}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className={itemClassNames}
                                onSelect={() => setModel("SmolLM2-1.7B")}
                            >
                                SmolLM2-1.7B
                                {model === "SmolLM2-1.7B" && <CheckIcon className="size-5" />}
                            </DropdownMenu.Item>
                        </DropdownMenu.SubContent>
                    </DropdownMenu.Sub>

                    <DropdownMenu.Item className={buttonClassNames} onSelect={handleFileClick}>
                        <UploadIcon /> Add files
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
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
        getChats(true).then(chats => {
            if (chats.length === 0) {
                if (!chatUUID) {
                    createChat().then(chat => {
                        localStorage.setItem("pendingMessage", prompt)
                        location.href = `/chat/${chat.uuid}`
                    })
                } else if (webSocket.current) {
                    webSocket.current.send(JSON.stringify({ "message": prompt }))

                    setMessages(previous => {
                        const previousMessages = [...previous]
                        previousMessages.push({ "text": prompt, "files": [], "is_user_message": true })
                        previousMessages.push({ "text": "", "files": [], "is_user_message": false })
                        return previousMessages
                    })

                    setPrompt("")
                    setIsAnyChatIncomplete(true)
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

    useEffect(() => {
        localStorage.setItem("model", model)
    }, [model])

    function handleStop() {
        getChats(true).then(chats => {
            if (webSocket.current) {
                if (chats.length > 0) {
                    webSocket.current.send(JSON.stringify({ action: "stop_message", "chat_uuid": chats[0].uuid }))
                }
            }
        })
        setIsAnyChatIncomplete(false)
    }

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