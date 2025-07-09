import React, { useState, useEffect, useRef } from "react"
import "./App.css"

type Message = { role: "user" | "bot"; content: string }

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const currentBotMessageRef = useRef("")
  const [currentBotMessage, setCurrentBotMessage] = useState("")
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    if (prefersDark) {
      import("./code_dark.css")
    } else {
      import("./code_light.css")
    }
  }, [])

  useEffect(() => {
    socket.current = new WebSocket(`ws://${window.location.host}/ws/chat/`)

    socket.current.addEventListener("message", event => {
      const data = JSON.parse(event.data)
      if (data.token) {
        currentBotMessageRef.current += data.token
        setCurrentBotMessage(currentBotMessageRef.current)
      } else if (data.message) {
        setMessages(previous => [...previous, { role: "bot", content: data.message }])
        currentBotMessageRef.current = ""
        setCurrentBotMessage("")
      }
    })

    return () => socket.current?.close()
  }, [])

  const sendMessage = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (socket.current && event.key === "Enter" && !event.shiftKey && input.trim()) {
      event.preventDefault()
      setInput("")
      setMessages(previous => [...previous, { role: "user", content: input }])
      setCurrentBotMessage("")
      socket.current.send(JSON.stringify({ message: input }))
    }
  }

  const getMessageDivClassName = (message: Message) => {
    return message.role === "user" ? "user-message-div" : "bot-message-div"
  }

  return (
    <div id="chat-div">
      <div id="messages-div">
        {messages.map((message, index) => (
          <div key={index} className={getMessageDivClassName(message)} dangerouslySetInnerHTML={{ __html: message.content }}></div>
        ))}
        {currentBotMessage && (<div className="bot-message-div">{currentBotMessage}</div>)}
      </div>
      <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here.." />
    </div>
  )
}