import { ArrowUpIcon, BoxModelIcon, ChevronRightIcon, Cross2Icon, PlusIcon, UploadIcon } from "@radix-ui/react-icons"
import { getChats, uploadFiles } from "../utils/api"
import { useRef, useState } from "react"
import type { Model, Message, UIAttachment } from "../types"
import { DropdownMenu } from "radix-ui"

export default function Prompt({ webSocket, setMessages }: {
    webSocket: React.RefObject<WebSocket | null>,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
}) {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [prompt, setPrompt] = useState("")
    const [model, setModel] = useState<Model>("SmolLM2-135M")
    const [currentFiles, setCurrentFiles] = useState<File[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])

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
            if (chats.length === 0 && webSocket.current) {
                if (webSocket.current) {
                    setMessages(previous => {
                        let messages = [...previous]
                        messages.push({ text: prompt, files: currentFiles.map(file => { return { name: file.name } }), is_user_message: true })
                        messages.push({ text: "", files: [], is_user_message: false })
                        return messages
                    })
                    if (currentFiles.length > 0) {
                        uploadFiles(currentFiles).then(files => {
                            if (webSocket.current) {
                                webSocket.current.send(JSON.stringify({ model: model, message: prompt, files: files }))
                                setPrompt("")
                                setCurrentFiles([])
                                setVisibleFiles([])
                            }
                        })
                    } else {
                        webSocket.current.send(JSON.stringify({ model: model, message: prompt }))
                        setPrompt("")
                    }
                }
            } else {
                alert("A chat is already in progress")
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

    return (
        <div className="flex flex-col w-[50vw] p-4 self-center">
            <div
                className={`flex flex-col gap-2 bg-gray-800 p-3 rounded-xl shadow-md transform transition-all duration-300 origin-bottom
            ${visibleFiles.length > 0 ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none h-0 p-0"}`}
            >
                {visibleFiles.map(file => (
                    <div
                        key={file.id}
                        className={`flex justify-between items-center bg-gray-700 px-3 py-1 rounded-lg transition-all duration-300
                    ${file.isRemoving ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}
                    >
                        <span className="text-sm text-white truncate">{file.file.name}</span>
                        <button
                            className="text-red-400 hover:text-red-500 ml-2"
                            onClick={() => removeFile(file.id)}
                        >
                            <Cross2Icon />
                        </button>
                    </div>
                ))}
            </div>

            <div
                className="flex gap-2 w-full bg-gray-700 rounded-[30px] px-4 py-3 items-center cursor-text"
                onClick={(e) => {
                    if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                        return
                    }
                    textAreaRef.current?.focus()
                }}
            >
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="hover:bg-gray-600 p-2.25 rounded-[20px] outline-none cursor-pointer self-end">
                            <PlusIcon className="scale-[1.5]" />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content className="flex flex-col bg-gray-600 p-2 rounded-xl translate-x-7 -translate-y-2">
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button className="flex items-center gap-2 hover:bg-gray-700 outline-none px-2 py-1 rounded cursor-pointer">
                                    <BoxModelIcon /> Model <ChevronRightIcon />
                                </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Content className="bg-gray-700 p-2 translate-x-2 -translate-y-8 rounded-xl" side="right">
                                <DropdownMenu.Item
                                    className={`hover:bg-gray-600 outline-none px-2 py-1 rounded cursor-pointer ${model === "SmolLM2-135M" && "bg-gray-800"}`}
                                    onSelect={_ => setModel("SmolLM2-135M")}
                                >
                                    SmolLM2-135M
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className={`hover:bg-gray-600 outline-none px-2 py-1 rounded cursor-pointer ${model === "SmolLM2-360M" && "bg-gray-800"}`}
                                    onSelect={_ => setModel("SmolLM2-360M")}
                                >
                                    SmolLM2-360M
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className={`hover:bg-gray-600 outline-none px-2 py-1 rounded cursor-pointer ${model === "SmolLM2-1.7B" && "bg-gray-800"}`}
                                    onSelect={_ => setModel("SmolLM2-1.7B")}
                                >
                                    SmolLM2-1.7B
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>

                        <DropdownMenu.Item
                            className="flex items-center gap-2 hover:bg-gray-700 outline-none px-2 py-1 rounded cursor-pointer"
                            onSelect={handleFileClick}>
                            <UploadIcon /> Add files
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    multiple
                />

                <textarea
                    className="flex-1 resize-none text-white outline-none px-2"
                    value={prompt}
                    placeholder="Ask me anything..."
                    rows={1}
                    ref={textAreaRef}
                    onChange={handleChange}
                    onKeyDown={sendMessageWithEvent}
                    style={{ maxHeight: "300px", overflowY: "auto" }}
                    autoFocus
                />
                {prompt.trim() &&
                    <button
                        className="bg-blue-700 hover:bg-blue-600 active:bg-blue-700 rounded-[25px] p-2 self-end"
                        onClick={sendMessage}
                    >
                        <ArrowUpIcon className="scale-[1.5]" />
                    </button>
                }
            </div>
        </div>
    )
}