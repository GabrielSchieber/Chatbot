export async function getChats(incomplete: boolean = false) {
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

export async function getMessages(chatUUID: string) {
    const response = await fetch("/api/get-messages/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_uuid: chatUUID })
    })
    const data = await response.json()
    return data.messages
}