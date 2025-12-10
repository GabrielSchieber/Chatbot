import { Cross2Icon } from "@radix-ui/react-icons"
import { t } from "i18next"
import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"

import { MAX_FILE_SIZE, MAX_FILES } from "./Chat"
import Composer from "./Composer"
import { useChat } from "../providers/ChatProvider"
import { useNotify } from "../providers/NotificationProvider"
import { newMessage, unarchiveChat } from "../utils/api"
import { getFileSize } from "../utils/misc"
import type { Model } from "../utils/types"

export default function Prompt() {
    const { chatUUID } = useParams()
    const navigate = useNavigate()

    const { chats, setChats, setMessages, isMobile } = useChat()
    const notify = useNotify()

    const [text, setText] = useState("")
    const [files, setFiles] = useState<File[]>([])
    const [model, setModel] = useState<Model>("SmolLM2-135M")

    const [shouldShowPendingNotification, setShouldShowPendingNotification] = useState(false)

    const pendingChat = chats.find(c => c.pending_message_id !== null)

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

                    previous.push({ id: highestID + 1, text, files: newFiles, is_from_user: true, model: null })
                    previous.push({ id: highestID + 2, text: "", files: [], is_from_user: false, model })

                    return previous
                })

                setText("")
                setFiles([])

                response.json().then(chat => {
                    if (chatUUID) {
                        setChats(previous => previous.map(c => c.uuid === chat.uuid ? chat : c))
                    } else {
                        navigate(`/chat/${chat.uuid}`)
                        setChats(previous => [...previous.map(c => ({ ...c, index: c.index + 1 })), chat])
                    }
                })
            } else {
                notify("Failed to send message.", "error")
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
            notify(t("prompt.file.error.tooMany", { max: MAX_FILES }), "error")
            e.target.value = ""
            return
        }

        const newFiles = Array.from(e.target.files)

        const currentTotal = files.map(f => f.size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)

        if (currentTotal + newTotal > MAX_FILE_SIZE) {
            notify(t("prompt.file.error.tooLarge", { limit: getFileSize(MAX_FILE_SIZE) }), "error")
            e.target.value = ""
            return
        }

        const currentKeys = new Set(files.map(f => f.name + "|" + f.size))
        const newUniqueFiles = newFiles.filter(f => !currentKeys.has(f.name + "|" + f.size))

        setFiles(previous => [...previous, ...newUniqueFiles])

        e.target.value = ""
    }

    return (
        chatUUID && chats.find(c => c.uuid === chatUUID)?.is_archived ? (
            <div className="flex flex-col gap-3 mb-10 items-center">
                <p>{t("prompt.unarchive.label")}</p>
                <button
                    className="
                        px-3 py-1 rounded-3xl cursor-pointer text-black light:text-white
                        bg-gray-100 light:bg-gray-900 hover:bg-gray-200 light:hover:bg-gray-800
                    "
                    onClick={_ => {
                        unarchiveChat(chatUUID)
                        setChats(previous => previous.map(c => c.uuid === chatUUID ? { ...c, is_archived: false } : c))
                    }}
                >
                    {t("prompt.unarchive.button")}
                </button>
            </div>
        ) : (
            <div className={`flex flex-col w-full items-center ${isMobile && "px-2 mt-auto"}`}>
                <AnimatePresence>
                    {shouldShowPendingNotification && pendingChat && (
                        <motion.div
                            key="pending-notification"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.25 }}
                            className="flex items-center justify-between gap-3 px-4 py-2 m-2 rounded-xl bg-gray-700 light:bg-gray-300"
                        >
                            <div>
                                {t("prompt.pendingNotificationPrefix")}{" "}
                                <a className="underline" href={`/chat/${pendingChat.uuid}`}>{pendingChat.title}</a>
                                {t("prompt.pendingNotificationSuffix")}
                            </div>
                            <button
                                className="p-1 rounded-3xl cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400"
                                onClick={() => setShouldShowPendingNotification?.(false)}
                            >
                                <Cross2Icon />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Composer
                    text={text}
                    setText={setText}
                    files={files.map((f, id) => ({ id, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type }))}
                    model={model}
                    setModel={setModel}
                    withBorderAndShadow={true}
                    tabIndex={1}
                    ariaLabel="Message composer"
                    onChangeFile={handleFileChange}
                    onRemoveFile={f => setFiles(previous => previous.filter(p => p.name + "|" + p.size !== f.name + "|" + f.content_size))}
                    onRemoveAllFiles={() => setFiles([])}
                    sendMessage={sendMessage}
                    sendMessageWithEvent={sendMessageWithEvent}
                />
            </div>
        )
    )
}