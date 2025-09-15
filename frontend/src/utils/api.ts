import type { Chat, Message, Model, Options, SearchEntry } from "../types"
import { apiFetch } from "./auth"

export async function deleteAccount() {
    return (await apiFetch("/api/delete-account/", { credentials: "include" })).status
}

export async function getChats(offset = 0, limit = 20): Promise<{ chats: Chat[], has_more: boolean }> {
    return (await apiFetch(`/api/get-chats/?offset=${offset}&limit=${limit}`, { credentials: "include" })).json()
}

export async function getPendingChats(): Promise<Chat[]> {
    return (await (await apiFetch(`/api/get-chats/?pending=${true}`, { credentials: "include" })).json()).chats
}

export async function searchChats(search: string, offset = 0, limit = 20): Promise<{ chats: SearchEntry[], has_more: boolean }> {
    return (await apiFetch(`/api/search-chats/?search=${search}&offset=${offset}&limit=${limit}`, { credentials: "include" })).json()
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

export async function getMessageFileContent(chat_uuid: string, id: number) {
    return await apiFetch(`/api/get-message-file-content/?chat_uuid=${chat_uuid}&message_file_id=${id}`, { credentials: "include" })
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

export async function newMessage(
    chatUUID: string,
    model: Model,
    options: Options,
    message: string,
    files: File[],
): Promise<[Promise<Chat>, number]> {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("model", model)
    formData.append("options", JSON.stringify(options))
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
    model: Model,
    options: Options,
    message: string,
    message_index: number,
    added_files: File[],
    removed_file_ids: number[]
): Promise<[Promise<Chat>, number]> {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("model", model)
    formData.append("options", JSON.stringify(options))
    formData.append("message", message)
    formData.append("message_index", message_index.toString())
    formData.append("removed_file_ids", JSON.stringify(removed_file_ids))
    added_files.forEach(added_file => formData.append("added_files", added_file))

    const response = await apiFetch("/api/edit-message/", {
        method: "POST",
        credentials: "include",
        body: formData
    })
    return [response.json(), response.status]
}

export async function regenerateMessage(
    chatUUID: string,
    model: Model,
    options: Options,
    message_index: number
): Promise<[Promise<Chat>, number]> {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("model", model)
    formData.append("options", JSON.stringify(options))
    formData.append("message_index", message_index.toString())

    const response = await apiFetch("/api/regenerate-message/", {
        method: "POST",
        credentials: "include",
        body: formData
    })
    return [response.json(), response.status]
}

export async function stopPendingChats() {
    await apiFetch("/api/stop-pending-chats/", { credentials: "include" })
}