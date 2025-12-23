import { t } from "i18next"
import { motion } from "motion/react"
import React, { useEffect, useRef, useState } from "react"

import { SendButton, StopButton } from "./Buttons"
import { BotMessage, UserMessage } from "./Messages"
import TextArea from "./TextArea"

export default function GuestChat() {
    const webSocket = useRef<WebSocket | null>(null)
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const selectionStart = useRef(0)
    const selectionEnd = useRef(0)

    const [text, setText] = useState("")
    const [messages, setMessages] = useState<string[]>([])
    const [isPending, setIsPending] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 750)

    function receiveMessage(e: MessageEvent<any>) {
        const data = JSON.parse(e.data)

        if (data.token || data.message) {
            let shouldSetMessages = true
            setMessages(previous => {
                if (shouldSetMessages) {
                    shouldSetMessages = false

                    previous = [...previous]

                    if (data.token) {
                        previous[data.message_index] += data.token
                    } else {
                        previous[data.message_index] = data.message
                    }
                }

                return previous
            })
        } else if (data === "end") {
            setIsPending(false)
        }
    }

    function sendMessage() {
        if (!webSocket.current || webSocket.current.readyState !== WebSocket.OPEN) return

        webSocket.current.send(JSON.stringify({ "message": text }))

        setMessages(previous => [...previous, text, ""])
        setText("")
        setIsPending(true)
    }

    function sendMessageWithEvent(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && text.trim() !== "") {
            e.preventDefault()
            if (!isPending) {
                sendMessage()
            }
        }
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
        const onResize = () => setIsMobile(window.innerWidth < 750)
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
                        {i % 2 === 0 ? (
                            <UserMessage index={i} text={m} />
                        ) : (
                            <BotMessage index={i} text={m} />
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
                        flex w-full max-h-[50vh] mb-5 px-4 py-1 overflow-hidden rounded-4xl
                        shadow-xl/50 border-t-4 border-gray-600 light:border-gray-400 bg-gray-800 light:bg-gray-200
                        ${text.split("\n").length > 1 || (textAreaRef.current?.clientHeight || 0) > 48 ? "items-end" : "items-center"}
                    `}
                    onClick={e => {
                        if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                            return
                        }
                        textAreaRef.current?.focus()
                    }}
                    aria-label="Message composer"
                >
                    <TextArea
                        ref={textAreaRef}
                        text={text}
                        setText={setText}
                        sendMessageWithEvent={sendMessageWithEvent}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                        tabIndex={1}
                    />

                    {isPending ? (
                        <StopButton
                            onClick={() => {
                                setIsPending(false)
                                webSocket.current?.send(JSON.stringify("end"))
                            }}
                            tabIndex={2}
                        />
                    ) : (
                        <SendButton sendMessage={sendMessage} isDisabled={isPending} tabIndex={2} />
                    )}
                </motion.div>
            </div>
        </div>
    )
}