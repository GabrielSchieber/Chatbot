import { t } from "i18next"
import { motion } from "motion/react"
import React, { useEffect, useRef, useState } from "react"

import { AddFilesButton, SelectModelButton, SendButton, StopButton } from "./Buttons"
import { Files } from "./Composer"
import { BotMessage, UserMessage } from "./Messages"
import { handleFileChange } from "./Prompt"
import TextArea from "./TextArea"
import { useNotify } from "../providers/NotificationProvider"
import type { Model, Message, MessageFile } from "../utils/types"

export default function GuestChat() {
    const notify = useNotify()

    const webSocket = useRef<WebSocket | null>(null)

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const selectionStart = useRef(0)
    const selectionEnd = useRef(0)

    const [text, setText] = useState("")
    const [files, setFiles] = useState<File[]>([])
    const [model, setModel] = useState<Model>("SmolLM2-135M")

    const [messages, setMessages] = useState<Message[]>([])

    const [isPending, setIsPending] = useState(false)

    const [isComposerExtended, setIsComposerExtended] = useState(false)

    const [isWidthSmall, setIsWidthSmall] = useState(window.innerWidth < 425)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 750)

    function receiveMessage(e: MessageEvent<any>) {
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
        } else if (data === "end") {
            setIsPending(false)
        }
    }

    async function sendMessage() {
        if (!webSocket.current || webSocket.current.readyState !== WebSocket.OPEN) return

        function blobToBase64(blob: Blob): Promise<string> {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => {
                    if (typeof reader.result === "string") {
                        resolve(reader.result)
                    } else {
                        reject("Failed to convert blob to base64")
                    }
                }
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        }

        const filesToSend = await Promise.all(files.map(async f => ({
            name: f.name,
            content: await blobToBase64(f),
            content_size: f.size,
            content_type: f.type
        })))

        webSocket.current.send(JSON.stringify({ "message": text, "files": filesToSend, "model": model }))

        setMessages(previous => {
            previous = [...previous]

            let highestID = 1
            for (const message of previous) {
                if (message.id >= highestID) {
                    highestID = message.id + 1
                }
            }

            previous.push(
                {
                    id: highestID,
                    text: text,
                    is_from_user: true,
                    model: "",
                    files: files.map((f, i) => ({ id: i, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type })),
                },
                {
                    id: highestID + 1,
                    text: "",
                    is_from_user: false,
                    model: "",
                    files: []
                }
            )

            return previous
        })

        setText("")
        setFiles([])

        setIsPending(true)
    }

    async function sendMessageWithEvent(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && text.trim() !== "") {
            e.preventDefault()
            if (!isPending) {
                await sendMessage()
            }
        }
    }

    function getMessageFiles() {
        return files.map((f, i) => ({ id: i, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type }))
    }

    function onRemoveFile(file: MessageFile) {
        setFiles(previous => previous.filter(p => p.name + "|" + p.size !== file.name + "|" + file.content_size))
    }

    function onRemoveAllFiles() {
        setFiles([])
    }

    function onStopClick() {
        if (!webSocket.current || webSocket.current.readyState !== WebSocket.OPEN) return

        webSocket.current.send(JSON.stringify("end"))
        setIsPending(false)
    }

    useEffect(() => {
        if (webSocket.current) return

        webSocket.current = new WebSocket("/ws/guest-chat/")
        webSocket.current.addEventListener("message", receiveMessage)

        return () => {
            webSocket.current?.removeEventListener("message", receiveMessage)
            webSocket.current?.close()
            webSocket.current = null
        }
    }, [])

    useEffect(() => {
        if (isWidthSmall) return
        setIsComposerExtended(isComposerExtended ? text !== "" : text.split("\n").length > 1 || (textAreaRef.current?.clientHeight || 0) > 48)
    }, [text, textAreaRef.current?.clientHeight])

    useEffect(() => {
        textAreaRef.current?.setSelectionRange(selectionStart.current, selectionEnd.current)
        textAreaRef.current?.focus()
    }, [isComposerExtended, textAreaRef.current, selectionStart.current, selectionEnd.current])

    useEffect(() => {
        setIsComposerExtended(isWidthSmall)
    }, [isWidthSmall])

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 750)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    useEffect(() => {
        const onResize = () => setIsWidthSmall(window.innerWidth < 425)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    return (
        <div className="flex flex-col size-full min-w-0 items-center overflow-y-auto">
            <header className="sticky top-0 flex w-full gap-1 p-2 items-center justify-between">
                <p className="text-2xl font-semibold not-md:text-[18px]">Chatbot</p>

                <div className="flex gap-2">
                    <a
                        className="
                            px-3 py-1 rounded-2xl
                            text-black light:text-white
                            bg-gray-100 hover:bg-gray-200
                            light:bg-gray-900 light:hover:bg-gray-800
                        "
                        href="login"
                    >
                        Log in
                    </a>
                    <a
                        className="
                            px-3 py-1 rounded-2xl
                            border border-gray-600 light:border-gray-400
                            bg-gray-800 hover:bg-gray-700
                            light:bg-gray-200 light:hover:bg-gray-300
                        "
                        href="signup"
                    >
                        Sign up
                    </a>
                </div>
            </header>

            <div className={`flex flex-col ${isMobile ? "w-full px-5" : "w-[60vw]"} ${messages.length > 0 ? "mb-auto py-15" : "mb-[25%]"}`}>
                {messages.map((m, i) =>
                    <React.Fragment key={i}>
                        {m.is_from_user ? (
                            <UserMessage index={i} text={m.text} files={m.files} />
                        ) : (
                            <BotMessage index={i} text={m.text} />
                        )}
                    </React.Fragment>
                )}
            </div>

            <h1
                className={`
                    text-3xl font-semibold text-center transition-opacity duration-300
                    ${messages.length > 0 ?
                        "fixed mt-25 top-0 bottom-0 translate-y-[25%] opacity-0 pointer-events-none" :
                        `mb-5 opacity-100 pointer-events-auto ${isMobile && "mt-auto"}
                    `}
                `}
            >
                {t("chat.header")}
            </h1>

            <div className={`sticky bottom-0 flex flex-col items-center ${isMobile ? "w-full px-2" : "w-[60vw]"} ${isMobile && messages.length === 0 && "mt-auto"}`}>
                <motion.div
                    layout={!window.matchMedia("(prefers-reduced-motion)").matches}
                    transition={{ type: "tween", duration: 0.15 }}
                    className={`
                        flex flex-col w-full max-h-[50vh] overflow-hidden rounded-4xl bg-gray-800 light:bg-gray-200
                        ${files.length > 0 ? "gap-2 px-4" : "px-3"}
                        ${files.length > 0 || isComposerExtended ? "pt-3 pb-2" : "py-1"}
                        mb-5 border-t-4 border-gray-600 light:border-gray-400 shadow-xl/50
                    `}
                    onClick={e => {
                        if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                            return
                        }
                        textAreaRef.current?.focus()
                    }}
                    aria-label="Message composer"
                >
                    <input
                        ref={fileInputRef}
                        className="hidden"
                        type="file"
                        onChange={e => handleFileChange(e, files, setFiles, notify)}
                        tabIndex={-1}
                        aria-hidden
                        multiple
                    />

                    {isComposerExtended ? (
                        <>
                            <div className="flex flex-col gap-1 overflow-x-hidden overflow-y-auto">
                                <Files files={getMessageFiles()} onRemoveFile={onRemoveFile} onRemoveAllFiles={onRemoveAllFiles} overflowYAuto={false} />

                                <TextArea
                                    ref={textAreaRef}
                                    text={text}
                                    setText={setText}
                                    sendMessageWithEvent={sendMessageWithEvent}
                                    selectionStart={selectionStart}
                                    selectionEnd={selectionEnd}
                                    tabIndex={1}
                                />
                            </div>

                            <div className="flex gap-1 items-center justify-between">
                                <AddFilesButton fileInputRef={fileInputRef} />

                                <div className="flex gap-1">
                                    <SelectModelButton model={model} setModel={setModel} isMobile={isMobile} />
                                    {isPending ? (
                                        <StopButton onClick={onStopClick} tabIndex={2} />
                                    ) : (
                                        <SendButton sendMessage={sendMessage} isDisabled={isPending || text.trim() === ""} tabIndex={2} />
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <Files files={getMessageFiles()} onRemoveFile={onRemoveFile} onRemoveAllFiles={onRemoveAllFiles} overflowYAuto={true} />
                            <div className="flex gap-1 items-center overflow-x-hidden overflow-y-auto">
                                <AddFilesButton fileInputRef={fileInputRef} />

                                <TextArea
                                    ref={textAreaRef}
                                    text={text}
                                    setText={setText}
                                    sendMessageWithEvent={sendMessageWithEvent}
                                    selectionStart={selectionStart}
                                    selectionEnd={selectionEnd}
                                    tabIndex={1}
                                />

                                <SelectModelButton model={model} setModel={setModel} isMobile={isMobile} />
                                {isPending ? (
                                    <StopButton onClick={onStopClick} tabIndex={2} />
                                ) : (
                                    <SendButton sendMessage={sendMessage} isDisabled={isPending || text.trim() === ""} tabIndex={2} />
                                )}
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    )
}