import { ArrowUpIcon, Cross2Icon, FileIcon, PlusIcon, UploadIcon } from "@radix-ui/react-icons"
import React, { useRef, useState } from "react"
import { useParams } from "react-router"
import { sendMessage as sendMessageAPI } from "../utils/api.ts"
import type { Message, Chat, UIAttachment, Model, Options } from "../types"
import { getFileSize, getFileType } from "../utils/file"

export default function Prompt({ setMessages, isAnyChatIncomplete, setIsAnyChatIncomplete, model, setModel, options, setOptions }: {
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
    isAnyChatIncomplete: boolean
    setIsAnyChatIncomplete: React.Dispatch<React.SetStateAction<boolean>>
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
    options: Options
    setOptions: React.Dispatch<React.SetStateAction<Options>>
}) {
    const { chatUUID } = useParams()
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [prompt, setPrompt] = useState("")
    const [currentFiles, setCurrentFiles] = useState<File[]>([])
    const [visibleFiles, setVisibleFiles] = useState<UIAttachment[]>([])
    const [inProgressChat, setInProgressChat] = useState<Chat | null>(null)
    const [isRemovingFiles, setIsRemovingFiles] = useState(false)

    function GeneratingMessageNotification({ title, uuid, }: { title: string, uuid: string }) {
        return (
            <div className="px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300">
                A message is already being generated in <a className="underline" href={`/chat/${uuid}`}>{title}</a>
            </div>
        )
    }

    function AddDropdown() {
        const [isDropdownOpen, setIsDropdownOpen] = useState(false)
        const buttonClassNames = "flex w-full px-1 gap-2 justify-between items-center cursor-pointer rounded hover:bg-gray-700 light:hover:bg-gray-300"

        return (
            <div className="relative flex flex-col self-end" onClick={e => e.stopPropagation()}>
                <button
                    className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400 z-2"
                    tabIndex={2}
                    onClick={_ => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <PlusIcon className="size-6" />
                </button>
                {isDropdownOpen && (
                    <>
                        <div className="fixed inset-0 z-1 cursor-auto" onClick={_ => setIsDropdownOpen(false)}></div>
                        <div className="absolute flex flex-col gap-1 p-2 self-center items-center cursor-auto bottom-12 left-0 rounded-xl bg-gray-800 light:bg-gray-200 z-2">
                            <button
                                className={buttonClassNames + " justify-start"}
                                onClick={_ => {
                                    fileInputRef.current?.click()
                                    setIsDropdownOpen(false)
                                }}>
                                <UploadIcon /> Add files
                            </button>
                        </div>
                    </>
                )}
            </div>

        )
    }

    function Attachments() {
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
            setIsRemovingFiles(true)
            setTimeout(() => {
                setVisibleFiles([])
                setCurrentFiles([])
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
                        key={file.id}
                        className={`
                            relative flex gap-1 p-2 w-fit items-center bg-gray-800/50 rounded-xl
                            transition-all duration-300 ${file.isRemoving ? "opacity-0 translate-x-10" : "opacity-100"}
                        `}
                    >
                        {getFileType(file.file.name) === "Image" ? (
                            <img
                                src={URL.createObjectURL(file.file)}
                                alt={file.file.name}
                                className="size-14 object-cover rounded-lg"
                            />
                        ) : (
                            <FileIcon className="size-14 bg-gray-800 p-2 rounded-lg" />
                        )}
                        <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                            <p className="px-2 py-1 rounded-lg bg-gray-800">
                                Type: {getFileType(file.file.name)}<br />
                                Name: {file.file.name}<br />
                                Size: {getFileSize(file.file.size)}
                            </p>
                        </div>
                        <button
                            className="absolute top-0 right-0 translate-x-2 -translate-y-2 cursor-pointer text-red-400 hover:text-red-500"
                            onClick={_ => removeFile(file.id)}
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

    function updateTextAreaHeight() {
        const textArea = textAreaRef.current
        if (textArea) {
            textArea.style.height = "auto"
            textArea.style.height = textArea.scrollHeight + "px"
        }
    }

    function sendMessage() {
        if (!chatUUID) {
            sendMessageAPI(chatUUID, "new_message", "Moondream", prompt, currentFiles)
                .then(([chat]) => chat.then(chat => {
                    location.href = `chat/${chat.uuid}`
                }))
        } else {
            sendMessageAPI(chatUUID, "new_message", "SmolLM2-135M", prompt, currentFiles)
                .then(([_, status]) => {
                    if (status === 200) {
                        setPrompt("")
                        setCurrentFiles([])
                        setVisibleFiles([])
                        setIsAnyChatIncomplete(true)

                        setMessages(previous => {
                            const previousMessages = [...previous]
                            previousMessages.push({
                                text: prompt,
                                files: currentFiles.map(f => { return { name: f.name, content_size: f.size, content_type: f.type } }),
                                role: "User"
                            })
                            previousMessages.push({ text: "", files: [], role: "Bot" })
                            return previousMessages
                        })
                    }
                })
        }
    }

    function sendMessageWithEvent(event: React.KeyboardEvent) {
        if (event.key === "Enter" && !event.shiftKey && (prompt.trim() || currentFiles.length > 0)) {
            event.preventDefault()
            sendMessage()
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
        if (totalSize > 5_000_000) {
            alert("Total file size exceeds 5 MB limit. Please select smaller files.")
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

    return (
        <div className="absolute bottom-0 flex flex-col w-[50vw] pb-4 self-center">
            {inProgressChat && <GeneratingMessageNotification title={inProgressChat.title} uuid={inProgressChat.uuid} />}

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
                {AddDropdown()}

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    multiple
                />

                <div className="flex flex-1 flex-col gap-3 max-h-100 overflow-y-auto">
                    {visibleFiles.length > 0 && Attachments()}
                    <div className="flex">
                        <textarea
                            className={`flex-1 px-2 content-center overflow-y-hidden resize-none outline-none ${visibleFiles.length > 0 && "py-2"}`}
                            value={prompt}
                            placeholder="Ask me anything..."
                            rows={1}
                            tabIndex={1}
                            ref={textAreaRef}
                            onChange={e => {
                                setPrompt(e.currentTarget.value)
                                updateTextAreaHeight()
                            }}
                            onKeyDown={sendMessageWithEvent}
                            autoFocus
                        />
                    </div>
                </div>

                {(prompt.trim() || currentFiles.length > 0) && !isAnyChatIncomplete &&
                    <button
                        className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end cursor-pointer"
                        tabIndex={3}
                        onClick={sendMessage}
                    >
                        <ArrowUpIcon className="size-6 text-white" />
                    </button>
                }
            </div>
        </div>
    )
}