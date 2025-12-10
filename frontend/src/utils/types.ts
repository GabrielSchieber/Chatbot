export type Language = "" | "English" | "Português"
export type Theme = "System" | "Light" | "Dark"
export type Model = "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream"

export type User = {
    email: string
    preferences: UserPreferences
    mfa: UserMFA
    sessions: UserSession[]
}

export type UserPreferences = {
    language: Language
    theme: Theme
    has_sidebar_open: boolean
    custom_instructions: string
    nickname: string
    occupation: string
    about: string
}

export type UserMFA = {
    is_enabled: boolean
}

export type UserSession = {
    login_at: string,
    logout_at: string | null,
    ip_address: string,
    browser: string,
    os: string
}

export type Chat = {
    uuid: string
    title: string
    pending_message_id: number | null
    is_archived: boolean
    index: number
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