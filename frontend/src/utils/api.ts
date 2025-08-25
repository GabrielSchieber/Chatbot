import type { Chat, Message, SearchEntry } from "../types"

export async function createChat(): Promise<Chat> {
    const response = await fetch("/api/create-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
    })
    return await response.json()
}

export async function getChats(incomplete: boolean = false): Promise<Chat[]> {
    const method = incomplete ? "POST" : "GET"
    const body = incomplete ? JSON.stringify({ incomplete: true }) : undefined
    const response = await fetch("/api/get-chats/", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body
    })
    const data = await response.json()
    return data.chats
}

export async function getMessages(chatUUID: string): Promise<Message[] | undefined> {
    const response = await fetch("/api/get-messages/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })
    const data = await response.json()
    return data.messages
}

export async function getMessage(chatUUID: string, message_index: number): Promise<string | undefined> {
    const response = await fetch("/api/get-message/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, message_index: message_index })
    })
    const data = await response.json()
    return data.text
}

export async function renameChat(chatUUID: string, newTitle: string) {
    const response = await fetch("/api/rename-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, new_title: newTitle })
    })
    return response.status
}

export async function deleteChat(chatUUID: string) {
    const response = await fetch("/api/delete-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })
    return response.status
}

export async function deleteChats() {
    return (await fetch("/api/delete-chats/", { credentials: "include" })).status
}

export async function deleteAccount() {
    return (await fetch("/api/delete-account/", { credentials: "include" })).status
}

export async function searchChats(search: string): Promise<SearchEntry[] | undefined> {
    const response = await fetch("/api/search-chats/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: search })
    })
    const data = await response.json()
    return data.chats
}

export async function uploadFiles(files: File[]): Promise<any> {
    const formData = new FormData()
    files.forEach(file => formData.append("files", file))

    const response = await fetch("/api/upload-files/", { method: "POST", body: formData })

    return await response.json()
}