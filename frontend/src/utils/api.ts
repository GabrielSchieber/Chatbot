import type { Model, Theme } from "../types"

export function signup(email: string, password: string) {
    return fetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
}

export function login(email: string, password: string) {
    return fetch("/api/login/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
}

export function logout() {
    return apiFetch("logout/", { method: "POST" })
}

export function me(theme?: Theme, hasSidebarOpen?: boolean) {
    if (theme === undefined && hasSidebarOpen === undefined) {
        return apiFetch("me/")
    } else {
        return apiFetch("me/", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme, has_sidebar_open: hasSidebarOpen })
        })
    }
}

export async function verifyMFA(preAuthToken: string, code: string) {
    return fetch("/api/mfa/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_auth_token: preAuthToken, code })
    })
}

export async function setupMFA() {
    return apiFetch("mfa/setup/", { method: "POST" })
}

export async function enableMFA(code: string) {
    return apiFetch("mfa/enable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
    })
}

export async function disableMFA(code: string) {
    return apiFetch("mfa/disable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
    })
}

export function deleteAccount() {
    return apiFetch("delete-account/", { method: "DELETE" })
}

export function getChats(offset = 0, limit = 20) {
    return apiFetch(`get-chats/?offset=${offset}&limit=${limit}`)
}

export function getPendingChats() {
    return apiFetch(`get-chats/?pending=true`)
}

export function getArchivedChats() {
    return apiFetch(`get-chats/?archived=true`)
}

export function searchChats(search: string, offset = 0, limit = 20) {
    return apiFetch(`search-chats/?search=${search}&offset=${offset}&limit=${limit}`)
}

export function renameChat(chatUUID: string, newTitle: string) {
    return apiFetch("rename-chat/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, new_title: newTitle })
    })
}

export function archiveOrUnarchiveChat(chatUUID: string, value: boolean) {
    return apiFetch("archive-or-unarchive-chat/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID, value })
    })
}

export function deleteChat(chatUUID: string) {
    return apiFetch("delete-chat/", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })
}

export function deleteChats() {
    return apiFetch("delete-chats/", { method: "DELETE" })
}

export function stopPendingChats() {
    return apiFetch("stop-pending-chats/", { method: "PATCH" })
}

export function getMessageFileContent(chatUUID: string, messageFileID: number) {
    return apiFetch(`get-message-file-content/?chat_uuid=${chatUUID}&message_file_id=${messageFileID}`)
}

export function getMessages(chatUUID: string) {
    return apiFetch(`get-messages/?chat_uuid=${chatUUID}`)
}

export function newMessage(chatUUID: string, text: string, model: Model, files: File[]) {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("text", text)
    formData.append("model", model)
    files.forEach(file => formData.append("files", file))
    return apiFetch("new-message/", { method: "POST", body: formData })
}

export function editMessage(
    chatUUID: string,
    text: string,
    index: number,
    model: Model,
    added_files: File[],
    removed_file_ids: number[]
) {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("text", text)
    formData.append("index", index.toString())
    formData.append("model", model)
    added_files.forEach(added_file => formData.append("added_files", added_file))
    formData.append("removed_file_ids", JSON.stringify(removed_file_ids))
    return apiFetch("edit-message/", { method: "PATCH", body: formData })
}

export function regenerateMessage(chatUUID: string, index: number, model: Model) {
    const formData = new FormData()
    formData.append("chat_uuid", chatUUID)
    formData.append("index", index.toString())
    formData.append("model", model)
    return apiFetch("regenerate-message/", { method: "PATCH", body: formData })
}

async function apiFetch(input: RequestInfo, init?: RequestInit) {
    let response = await fetch(`/api/${input}`, { ...init, credentials: "include" })

    if (response.status === 401) {
        const refreshResponse = await fetch("/api/refresh/", { method: "POST", credentials: "include" })

        if (refreshResponse.ok) {
            response = await fetch(`/api/${input}`, { ...init, credentials: "include" })
        }
    }

    return response
}