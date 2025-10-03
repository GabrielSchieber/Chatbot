import { ArrowUpIcon, BoxModelIcon, Cross2Icon, PlusIcon } from "@radix-ui/react-icons"
import { motion, AnimatePresence } from "motion/react"
import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router"

import Attachments from "../ui/Attachments"
import Dropdown from "../ui/Dropdown"
import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { useChat } from "../../context/ChatProvider"
import { newMessage } from "../../utils/api"
import { getFileSize } from "../../utils/file"
import type { Model } from "../../types"

export default function PromptBar() {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

    const { setMessages, pendingChat, setPendingChat, isLoading } = useChat()

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [text, setText] = useState("")
    const [files, setFiles] = useState<File[]>([])
    const [model, setModel] = useState<Model>("SmolLM2-135M")

    const [shouldShowPendingNotification, setShouldShowPendingNotification] = useState(false)

    const [isExtended, setIsExtended] = useState(false)

    const isSendButtonDisabled = (text.trim() === "" && files.length === 0) || pendingChat !== null || isLoading

    function sendMessage() {
        newMessage(chatUUID || "", text, model, files).then(response => {
            if (response.ok) {
                setMessages(previous => {
                    previous = [...previous]

                    const highestID = previous.map(p => p.id).sort().at(-1) || 1
                    const highestFileID = previous.flatMap(p => p.files).map(f => f.id).sort().at(-1) || 1
                    const newFiles = files.map((f, i) => ({
                        id: highestFileID + i + 1,
                        name: f.name,
                        content_size: f.size,
                        content_type: f.type
                    }))

                    previous.push({ id: highestID + 1, text, files: newFiles, is_from_user: true, model: undefined })
                    previous.push({ id: highestID + 2, text: "", files: [], is_from_user: false, model })

                    return previous
                })

                setText("")
                setFiles([])

                response.json().then(chat => {
                    navigate(`/chat/${chat.uuid}`)
                    setPendingChat(chat)
                })
            } else {
                alert("Failed to send message")
            }
        })
    }

    function sendMessageWithEvent(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && (text.trim() !== "" || files.length > 0)) {
            e.preventDefault()
            if (!pendingChat) {
                sendMessage()
            } else if (!shouldShowPendingNotification) {
                setShouldShowPendingNotification(true)
                setTimeout(() => setShouldShowPendingNotification(false), 2000)
            }
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return

        if (files.length + e.target.files.length > MAX_FILES) {
            alert(`You can only attach up to ${MAX_FILES} files at a time.`)
            e.target.value = ""
            return
        }

        const newFiles = Array.from(e.target.files)

        const currentTotal = files.map(f => f.size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)

        if (currentTotal + newTotal > MAX_FILE_SIZE) {
            alert(`Total file size exceeds ${getFileSize(MAX_FILE_SIZE)} limit. Please select smaller files.`)
            e.target.value = ""
            return
        }

        const currentKeys = new Set(files.map(f => f.name + "|" + f.size))
        const newUniqueFiles = newFiles.filter(f => !currentKeys.has(f.name + "|" + f.size))

        setFiles(previous => [...previous, ...newUniqueFiles])

        e.target.value = ""
    }

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.style.height = "auto"
            textAreaRef.current.style.height = textAreaRef.current.scrollHeight + "px"
        }
    }, [text])

    useEffect(() => {
        if (files.length > 0) {
            setIsExtended(true)
        } else {
            const lineCount = text.split("\n").length
            setIsExtended(lineCount > 1 || text.length > 80)
        }
    }, [text, files])

    return (
        <>
            <AnimatePresence>
                {shouldShowPendingNotification && pendingChat && (
                    <motion.div
                        key="pending-notification"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center justify-between gap-3 px-4 py-2 m-2 rounded-xl bg-gray-700 light:bg-gray-300 z-10"
                    >
                        <div>
                            A message is already being generated in <a className="underline" href={`/chat/${pendingChat.uuid}`}>{pendingChat.title}</a>
                        </div>
                        <button className="p-1 rounded-3xl cursor-pointer hover:bg-gray-800" onClick={_ => setShouldShowPendingNotification(false)}>
                            <Cross2Icon />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                layout
                transition={{ layout: { duration: 0.1, ease: "easeInOut" } }}
                className="w-full max-w-3xl mx-auto mb-5 p-2 rounded-2xl bg-gray-800 light:bg-gray-200"
            >
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple />

                {isExtended ? (
                    <motion.div layout className="flex flex-col gap-1">
                        <div className="flex flex-col max-h-100 gap-1 overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                            <Files files={files} setFiles={setFiles} />
                            <TextArea ref={textAreaRef} text={text} setText={setText} sendMessageWithEvent={sendMessageWithEvent} />
                        </div>

                        <div className="flex justify-between items-center px-1">
                            <div className="flex gap-1">
                                <AttachButton fileInputRef={fileInputRef} />
                                <Dropdown icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
                            </div>
                            <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} />
                        </div>
                    </motion.div>
                ) : (
                    <motion.div layout className="flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                            <AttachButton fileInputRef={fileInputRef} />
                            <Dropdown icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
                        </div>
                        <TextArea ref={textAreaRef} text={text} setText={setText} sendMessageWithEvent={sendMessageWithEvent} />
                        <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} />
                    </motion.div>
                )}
            </motion.div>
        </>
    )
}

function Files({ files, setFiles }: { files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>> }) {
    return (
        <AnimatePresence>
            {files.length > 0 && (
                <motion.div
                    layout
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex flex-wrap gap-2 p-2 rounded-xl border bg-gray-700 light:bg-gray-300 border-gray-200 light:border-gray-800"
                >
                    <Attachments
                        files={files.map((f, i) => ({ id: i, name: f.name, content_size: f.size, content_type: f.type }))}
                        onRemove={f => setFiles(previous => previous.filter(p => p.name + "|" + p.size !== f.name + "|" + f.content_size))}
                        onRemoveAll={() => setFiles([])}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function TextArea({ ref, text, setText, sendMessageWithEvent }: {
    ref: React.RefObject<HTMLTextAreaElement | null>
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    sendMessageWithEvent: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
    return (
        <motion.div className="flex flex-1">
            <motion.textarea
                ref={ref}
                className="flex-1 resize-none overflow-hidden rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={text}
                placeholder="Ask me anything..."
                onChange={e => setText(e.target.value)}
                onKeyDown={sendMessageWithEvent}
                rows={1}
            />
        </motion.div>
    )
}

function AttachButton({ fileInputRef }: { fileInputRef: React.RefObject<HTMLInputElement | null> }) {
    return (
        <button
            className="p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300 transition"
            onClick={_ => fileInputRef.current?.click()}
        >
            <PlusIcon className="size-5" />
        </button>
    )
}

function SendButton({ sendMessage, isDisabled }: { sendMessage: () => void, isDisabled: boolean }) {
    return (
        <button
            className="
                p-1.5 rounded-full cursor-pointer bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500
                disabled:hover:bg-gray-600 disabled:cursor-not-allowed transition
            "
            onClick={sendMessage}
            disabled={isDisabled}
        >
            <ArrowUpIcon className="size-5" />
        </button>
    )
}