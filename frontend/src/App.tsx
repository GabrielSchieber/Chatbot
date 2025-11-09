import { useEffect, useRef, useState } from "react"

import "./App.css"

export default function App() {
    const webSocket = useRef<WebSocket | null>(null)
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

    const [prompt, setPrompt] = useState("")
    const [messages, setMessages] = useState<string[]>([])

    function sendMessage(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
            e.preventDefault()
            setMessages(previous => [...previous, prompt, ""])
            webSocket.current?.send(JSON.stringify({ message: prompt }))
            setPrompt("")
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
                        <div key={i} className={`flex flex-col w-[60vh] ${i % 2 === 0 ? "items-end" : "items-start"}`}>
                            {i % 2 === 0 ? (
                                <div className="min-w-20 max-w-[80%] px-3 py-2 rounded-2xl break-all whitespace-pre-wrap bg-gray-800">
                                    {m}
                                </div>
                            ) : (
                                <div className="w-full break-all whitespace-pre-wrap">
                                    {m}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col w-full items-center">
                    <div className="flex flex-col w-[60vw] max-h-[50vh] mb-5 px-3 py-1 rounded-4xl bg-gray-800">
                        <div className="flex flex-col gap-1 overflow-x-hidden overflow-y-auto">
                            <div className="flex flex-1">
                                <textarea
                                    ref={textAreaRef}
                                    className="flex-1 p-2 overflow-hidden resize-none outline-none"
                                    value={prompt}
                                    placeholder="Ask me anything..."
                                    onChange={e => setPrompt(e.target.value)}
                                    onKeyDown={sendMessage}
                                    rows={1}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}