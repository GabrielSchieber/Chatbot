import type { Chat, Message, SearchEntry, Theme } from "../types"
import { apiFetch } from "./auth"

export async function getTheme(): Promise<Theme> {
    return (await apiFetch("/api/get-theme/", { credentials: "include" })).json()
}

export async function setTheme(theme: Theme): Promise<number> {
    const response = await apiFetch("/api/set-theme/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme })
    })
    return response.status
}

export async function deleteAccount() {
    return (await apiFetch("/api/delete-account/", { credentials: "include" })).status
}

export async function getChats(pending: boolean = false): Promise<Chat[]> {
    const method = pending ? "POST" : "GET"
    const body = pending ? JSON.stringify({ pending: true }) : undefined
    const response = await apiFetch("/api/get-chats/", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body
    })
    const data = await response.json()
    return data.chats
}

export async function searchChats(search: string): Promise<SearchEntry[] | undefined> {
    const response = await apiFetch("/api/search-chats/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: search })
    })
    const data = await response.json()
    return data.chats
}

export async function renameChat(chatUUID: string, newTitle: string) {
    const response = await apiFetch("/api/rename-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, new_title: newTitle })
    })
    return response.status
}

export async function deleteChat(chatUUID: string) {
    const response = await apiFetch("/api/delete-chat/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })
    return response.status
}

export async function deleteChats() {
    return (await apiFetch("/api/delete-chats/", { credentials: "include" })).status
}

export async function getMessages(chatUUID: string): Promise<Message[] | undefined> {
    const response = await apiFetch("/api/get-messages/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })
    const data = await response.json()
    return data.messages
}

export async function getMessage(chatUUID: string, message_index: number): Promise<string | undefined> {
    const response = await apiFetch("/api/get-message/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, message_index: message_index })
    })
    const data = await response.json()
    return data.text
}

export async function newMessage(
    chatUUID: string,
    model: "SmolLM2-135M" | "Moondream",
    message: string,
    files: File[],
): Promise<[Promise<Chat>, number]> {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("model", model)
    formData.append("message", message)
    files.forEach(file => formData.append("files", file))

    const response = await apiFetch("/api/new-message/", {
        method: "POST",
        credentials: "include",
        body: formData
    })
    return [response.json(), response.status]
}

export async function editMessage(
    chatUUID: string,
    model: "SmolLM2-135M" | "Moondream",
    message: string,
    message_index: number
): Promise<[Promise<Chat>, number]> {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("model", model)
    formData.append("message", message)
    formData.append("message_index", message_index.toString())

    const response = await apiFetch("/api/edit-message/", {
        method: "POST",
        credentials: "include",
        body: formData
    })
    return [response.json(), response.status]
}

export async function renegerateMessage(
    chatUUID: string,
    model: "SmolLM2-135M" | "Moondream",
    message_index: number
): Promise<[Promise<Chat>, number]> {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("model", model)
    formData.append("message_index", message_index.toString())

    const response = await apiFetch("/api/regenerate-message/", {
        method: "POST",
        credentials: "include",
        body: formData
    })
    return [response.json(), response.status]
}