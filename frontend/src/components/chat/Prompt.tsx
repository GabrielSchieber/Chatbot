import { BoxModelIcon, Cross2Icon } from "@radix-ui/react-icons"
import { motion, AnimatePresence } from "motion/react"
import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router"

import Attachments from "../ui/Attachments"
import { AttachButton, ModelButton, SendButton, StopButton } from "../ui/Buttons"
import TextArea from "../ui/TextArea"
import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { useChat } from "../../context/ChatProvider"
import { newMessage } from "../../utils/api"
import { getFileSize } from "../../utils/file"
import type { Model } from "../../types"

export default function Prompt() {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

    const { setMessages, pendingChat, setPendingChat, isLoading } = useChat()

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
                        content: f.slice(),
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
        setIsExtended(text.split("\n").length > 1 || text.length > 80)
    }, [text])

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
                className="flex flex-col gap-1 w-[60vw] mb-5 px-2 py-1 rounded-2xl bg-gray-800 light:bg-gray-200"
            >
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple />

                <div className="flex flex-col max-h-100 gap-1 overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                    <Files files={files} setFiles={setFiles} />
                    {isExtended && <TextArea text={text} setText={setText} sendMessageWithEvent={sendMessageWithEvent} />}
                </div>

                <div className="flex gap-2 items-center justify-between">
                    <div className="flex gap-1">
                        <AttachButton fileInputRef={fileInputRef} />
                        <ModelButton icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
                    </div>
                    {!isExtended && <TextArea text={text} setText={setText} sendMessageWithEvent={sendMessageWithEvent} />}
                    {pendingChat !== null ? (
                        <StopButton />
                    ) : (
                        <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} />
                    )}
                </div>
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
                    className="flex flex-wrap gap-2 p-1.5 rounded-xl border bg-gray-700 light:bg-gray-300 border-gray-200 light:border-gray-800"
                >
                    <Attachments
                        files={files.map((f, id) => ({ id, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type }))}
                        onRemove={f => setFiles(previous => previous.filter(p => p.name + "|" + p.size !== f.name + "|" + f.content_size))}
                        onRemoveAll={() => setFiles([])}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    )
}