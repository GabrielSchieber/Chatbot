import type { Chat, Message, Model, Options, SearchEntry } from "../types"
import type { Theme, User } from "../types"

export async function signup(email: string, password: string) {
    const response = await fetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    if (response.ok) {
        try {
            await login(email, password)
        } catch {
            throw new Error("Log in after sign up was not possible.")
        }
    } else {
        throw new Error("Sign up was not possible.")
    }

    return response.status
}

export async function login(email: string, password: string) {
    const response = await fetch("/api/login/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    if (!response.ok) {
        throw Error("Login was not possible")
    }

    return response.status
}

export async function logout() {
    return (await apiFetch("logout/", { method: "POST" })).status
}

export async function getCurrentUser(): Promise<User | null> {
    const response = await apiFetch("me/")
    if (!response.ok) {
        return null
    }
    return await response.json()
}

export async function setCurrentUser(theme?: Theme, hasSidebarOpen?: boolean) {
    return (await apiFetch("me/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, has_sidebar_open: hasSidebarOpen })
    })).status
}

export async function deleteAccount() {
    return (await apiFetch("delete-account/", { method: "DELETE" })).status
}

export async function getChats(offset = 0, limit = 20): Promise<{ chats: Chat[], has_more: boolean }> {
    return (await apiFetch(`get-chats/?offset=${offset}&limit=${limit}`)).json()
}

export async function getPendingChats(): Promise<Chat[]> {
    return (await apiFetch(`get-chats/?pending=true`)).json()
}

export async function searchChats(search: string, offset = 0, limit = 20): Promise<{ chats: SearchEntry[], has_more: boolean }> {
    return (await apiFetch(`search-chats/?search=${search}&offset=${offset}&limit=${limit}`)).json()
}

export async function renameChat(chatUUID: string, newTitle: string) {
    return (await apiFetch("rename-chat/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, new_title: newTitle })
    })).status
}

export async function deleteChat(chatUUID: string) {
    return (await apiFetch("delete-chat/", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })).status
}

export async function deleteChats() {
    return (await apiFetch("delete-chats/", { method: "DELETE" })).status
}

export async function stopPendingChats() {
    return (await apiFetch("stop-pending-chats/", { method: "PATCH" })).status
}

export async function getMessage(chatUUID: string, messageIndex: number): Promise<Message | undefined> {
    return (await apiFetch(`get-message/?chat_uuid=${chatUUID}&message_index=${messageIndex}`)).json()
}

export async function getMessageFileContent(chatUUID: string, messageFileID: number) {
    return await apiFetch(`get-message-file-content/?chat_uuid=${chatUUID}&message_file_id=${messageFileID}`)
}

export async function getMessages(chatUUID: string): Promise<Message[] | undefined> {
    return (await apiFetch(`get-messages/?chat_uuid=${chatUUID}`)).json()
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

    const response = await apiFetch("new-message/", { method: "POST", body: formData })
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

    const response = await apiFetch("edit-message/", { method: "PATCH", body: formData })
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

    const response = await apiFetch("regenerate-message/", { method: "PATCH", body: formData })
    return [response.json(), response.status]
}

async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    let response = await fetch(`/api/${input}`, { ...init, credentials: "include" })

    if (response.status === 401) {
        const refreshResponse = await fetch("/api/refresh/", { method: "POST", credentials: "include" })

        if (refreshResponse.ok) {
            response = await fetch(`/api/${input}`, { ...init, credentials: "include" })
        }
    }

    return response
}