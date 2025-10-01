import { useEffect, useState } from "react"

import { getChats } from "../utils/api"
import type { Chat } from "../types"

export function Sidebar() {
    return (
        <div className="flex flex-col w-60 text-center bg-gray-800 light:bg-gray-200">
            <TopButtons />
            <History />
            <SettingsButton />
        </div>
    )
}

function TopButtons() {
    return (
        <div className="flex flex-col gap-1">
            <button>Toggle Sidebar</button>
            <a href="/">New Chat</a>
            <button>Search chats</button>
        </div>
    )
}

function History() {
    const [chats, setChats] = useState<Chat[]>([])

    useEffect(() => {
        getChats(0, 20).then(response => {
            if (response.ok) {
                response.json().then(data => {
                    setChats(data.chats)
                })
            }
        })
    }, [])

    return (
        <div className="flex flex-col h-full bg-gray-800/50 light:bg-gray-200/50">
            {chats.map(c => (
                <a key={c.uuid} href={`/chat/${c.uuid}`}>{c.title}</a>
            ))}
        </div>
    )
}

function SettingsButton() {
    return (
        <button>Settings</button>
    )
}