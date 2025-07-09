import React, { useState, useEffect, useRef } from "react"
import "./App.css"

export default function App() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState("")
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    socket.current = new WebSocket(`ws://${window.location.host}/ws/chat/`)
    socket.current.onmessage = event => {
      const data = JSON.parse(event.data)
      setMessages(previous => [...previous, data.message])
    }
    return () => socket.current?.close()
  }, [])

  const sendMessage = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (socket.current && event.key === "Enter" && !event.shiftKey && input.trim()) {
      event.preventDefault()
      socket.current.send(JSON.stringify({ message: input }))
      setMessages(previous => [...previous, input])
      setInput("")
    }
  }

  const getMessageDivClassName = (index: number) => {
    return index % 2 === 0 ? "user-message-div" : "bot-message-div"
  }

  return (
    <div id="chat-div">
      <div id="messages-div">
        {messages.map((message, index) => (
          <div key={index} className={getMessageDivClassName(index)}>{message}</div>
        ))
        }
      </div>
      <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here.." />
    </div>
  )
}