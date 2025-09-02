import { ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, Cross2Icon, FileIcon, MixIcon, PauseIcon, PlusIcon, UploadIcon } from "@radix-ui/react-icons"
import { Slider } from "radix-ui"
import React, { useEffect, useRef, useState, type ReactNode } from "react"
import { useParams } from "react-router"
import { createChat, getChats, uploadFiles } from "../utils/api"
import type { Model, Message, UIAttachment, Chat, Options } from "../types"
import { getFileSize, getFileType } from "../utils/file"

export default function Prompt({ webSocket, setMessages, isAnyChatIncomplete, setIsAnyChatIncomplete, model, setModel, options, setOptions }: {
    webSocket: React.RefObject<WebSocket | null>,
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

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isDropdownOptionsOpen, setIsDropdownOptionsOpen] = useState(false)
    const [isDropdownModelOpen, setIsDropdownModelOpen] = useState(false)

    const [isRemovingFiles, setIsRemovingFiles] = useState(false)

    function GeneratingMessageNotification({ title, uuid, }: { title: string, uuid: string }) {
        return (
            <div className="px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300">
                A message is already being generated in <a className="underline" href={`/chat/${uuid}`}>{title}</a>
            </div>
        )
    }

    function AddDropdown() {
        function OptionItem({ label, optionKey, slider }: {
            label: ReactNode,
            optionKey: "max_tokens" | "temperature" | "top_p" | "seed"
            slider?: { min: number, max: number, step: number }
        }) {
            const optionsClassNames = "flex items-center justify-between text-sm gap-1 px-1 rounded bg-gray-700 light:bg-gray-300"
            const optionsPClassNames = "flex-1 truncate"
            const optionsInputClassNames = `
                flex-1 px-1.5 m-1 outline-none rounded bg-gray-600 light:bg-gray-400/30
                hover:bg-gray-500 light:hover:bg-gray-400/70 focus:bg-gray-500 light:focus:bg-gray-400/70
            `

            const [sliderValue, setSliderValue] = useState<number | null>(null)

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
                    <div className="flex flex-col gap-1">
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
                        {slider && (
                            <Slider.Root
                                className="relative flex pb-2 items-center touch-none select-none"
                                defaultValue={[options[optionKey]]}
                                min={slider.min}
                                max={slider.max}
                                step={slider.step}
                                onValueChange={([v]) => setSliderValue(v)}
                                onPointerUp={_ => {
                                    if (sliderValue) {
                                        handleSetOptions(sliderValue.toString())
                                    }
                                }}
                            >
                                <Slider.Track className="relative h-[4px] grow rounded-full">
                                    <Slider.Range className="absolute h-full rounded-full bg-gray-300 light:bg-gray-700" />
                                </Slider.Track>
                                <Slider.Thumb
                                    className="
                                        block size-3 rounded-[10px] bg-gray-200 light:bg-gray-800 focus:shadow-[0_0_0_5px]
                                        focus:shadow-blackA5 focus:outline-none cursor-pointer
                                    "
                                />
                            </Slider.Root>
                        )}
                    </div>
                </div>
            )
        }

        function ModelItem({ modelName }: { modelName: "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream" }) {
            return (
                <button
                    className={`
                        flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400/50
                        ${modelName === model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                    `}
                    onClick={_ => setModel(modelName)}
                >
                    {modelName}
                    {modelName == model && <CheckIcon className="size-5" />}
                </button>
            )
        }

        const buttonClassNames = "flex w-full px-1 gap-2 justify-between items-center cursor-pointer rounded hover:bg-gray-700 light:hover:bg-gray-300"
        const dropdownClassNames = "absolute flex flex-col gap-1 p-2 rounded-xl bg-gray-800 light:bg-gray-200"

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
                                className={buttonClassNames}
                                onClick={_ => {
                                    setIsDropdownOptionsOpen(!isDropdownOptionsOpen)
                                    setIsDropdownModelOpen(false)
                                }}
                            >
                                <MixIcon /> Options {isDropdownOptionsOpen ? <ChevronRightIcon /> : <ChevronDownIcon />}
                            </button>
                            {isDropdownOptionsOpen && (
                                <div className={dropdownClassNames + " bottom-15 left-32"}>
                                    <OptionItem label="🔣 Max. Tokens" optionKey="max_tokens" slider={{ min: 32, max: 4096, step: 32 }} />
                                    <OptionItem label="🌡 Temperature" optionKey="temperature" slider={{ min: 0.1, max: 2, step: 0.1 }} />
                                    <OptionItem label={"⬆ Top P"} optionKey="top_p" slider={{ min: 0.1, max: 2, step: 0.1 }} />
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
                                    <ModelItem modelName="Moondream" />
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
                    </>
                )}
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
                        webSocket.current.send(JSON.stringify({ model: model, message: prompt, options: options }))
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
        localStorage.setItem("options", JSON.stringify(options))
    }, [options])

    useEffect(() => updateTextAreaHeight(), [visibleFiles.length])

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
                <AddDropdown />

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    multiple
                />

                <div className="flex flex-1 flex-col gap-3 max-h-100 overflow-y-auto">
                    {visibleFiles.length > 0 && (
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
                    )}
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

                {prompt.trim() && !isAnyChatIncomplete &&
                    <button
                        className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end cursor-pointer"
                        tabIndex={3}
                        onClick={sendMessage}
                    >
                        <ArrowUpIcon className="size-6 text-white" />
                    </button>
                }

                {isAnyChatIncomplete &&
                    <button
                        className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end cursor-pointer"
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