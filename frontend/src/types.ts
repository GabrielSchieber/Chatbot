export type Theme = "System" | "Light" | "Dark"
export type Model = "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream"

export type User = {
    email: string
    theme: Theme
    has_sidebar_open: boolean
}

export type Chat = {
    uuid: string
    title: string
    pending_message_id: number | null
}

export type MessageFile = {
    id: number
    name: string
    content: Blob | null
    content_size: number
    content_type: string
}

export type Message = {
    id: number
    text: string
    is_from_user: boolean
    files: MessageFile[]
    model: Model | null
}