import { useEffect, useRef, useState } from "react"

import "./App.css"

export default function App() {
    const webSocket = useRef<WebSocket | null>(null)
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

    const [prompt, setPrompt] = useState("")
    const [messages, setMessages] = useState<string[]>([])

    const [hasCopiedIndex, setHasCopiedIndex] = useState(-1)
    const [copiedTimeoutID, setCopiedTimeoutID] = useState(-1)

    function sendMessage() {
        if (!webSocket.current || webSocket.current.readyState !== WebSocket.OPEN) return

        setMessages(previous => [...previous, prompt, ""])
        webSocket.current.send(JSON.stringify({ message: prompt }))
        setPrompt("")
    }

    function sendMessageOnEnter(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
            e.preventDefault()
            sendMessage()
        }
    }

    function receiveMessage() {
        if (!webSocket.current) {
            webSocket.current = new WebSocket(`ws://${location.host}/ws/chat/`)

            webSocket.current.addEventListener("message", e => {
                const data = JSON.parse(e.data)

                if (data.token || data.message) {
                    setMessages(previous => {
                        if (previous.length === 0) return previous

                        previous = [...previous]

                        if (data.token) {
                            previous[previous.length - 1] += data.token
                        } else {
                            previous[previous.length - 1] = data.message
                        }

                        return previous
                    })
                }
            })
        }
    }

    function resizeTextArea() {
        const textArea = textAreaRef.current
        if (!textArea) return
        textArea.style.height = "auto"
        textArea.style.height = textArea.scrollHeight + "px"
    }

    useEffect(receiveMessage, [])
    useEffect(resizeTextArea, [prompt])

    return (
        <div className="flex w-screen h-screen overflow-hidden text-white bg-gray-900">
            <div className="flex flex-col size-full items-center">
                <div className="flex flex-col w-full h-[100%] gap-3 px-5 py-10 items-center overflow-y-auto">
                    {messages.map((m, i) =>
                        <div key={i} className={`flex flex-col w-[60vh] gap-1 ${i % 2 === 0 ? "items-end" : "items-start"}`}>
                            {i % 2 === 0 ? (
                                <div className="min-w-20 max-w-[80%] px-3 py-2 rounded-2xl break-all whitespace-pre-wrap bg-gray-800">
                                    {m}
                                </div>
                            ) : (
                                <div className="w-full break-all whitespace-pre-wrap">
                                    {m}
                                </div>
                            )}

                            <button
                                className="px-2 py-1 text-xs rounded-lg cursor-pointer hover:bg-gray-700"
                                onClick={_ => {
                                    navigator.clipboard.writeText(m)
                                    setHasCopiedIndex(i)
                                    clearTimeout(copiedTimeoutID)
                                    setCopiedTimeoutID(setTimeout(() => setHasCopiedIndex(-1), 3000))
                                }}
                            >
                                {hasCopiedIndex === i ? "Copied" : "Copy"}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col w-full items-center">
                    <div className="flex flex-col w-[60vw] max-h-[50vh] mb-5 px-3 py-1 rounded-4xl bg-gray-800">
                        <div className="flex flex-col gap-1 overflow-x-hidden overflow-y-auto">
                            <div className="flex gap-2 items-center justify-between">
                                <div className="flex flex-1">
                                    <textarea
                                        ref={textAreaRef}
                                        className="flex-1 p-2 overflow-hidden resize-none outline-none"
                                        value={prompt}
                                        placeholder="Ask me anything..."
                                        onChange={e => setPrompt(e.target.value)}
                                        onKeyDown={sendMessageOnEnter}
                                        maxLength={10000}
                                        rows={1}
                                        autoFocus
                                    />
                                </div>
                                {prompt.trim() && (
                                    <button
                                        className="self-end mx-2 mb-0.5 px-2 py-1 rounded-lg cursor-pointer border border-gray-600 bg-gray-900 hover:bg-gray-700"
                                        onClick={sendMessage}
                                    >
                                        Send
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}