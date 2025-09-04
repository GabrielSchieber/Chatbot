export type Model = "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream"
export type Theme = "System" | "Light" | "Dark"
export type SidebarState = "Open" | "Closed"
export type Role = "User" | "Bot"

export type User = { id: number, email: string, theme: Theme, has_sidebar_open: boolean }

export type Chat = { title: string, is_pending: boolean, uuid: string }

export type Message = { text: string, files: MessageFile[], role: Role, model: Model | undefined }
export type MessageFile = { id: number, name: string, content_size: number, content_type: string }

export type SearchEntry = { title: string, matches: string[], uuid: string }

export type UIAttachment = { message_file: MessageFile, isRemoving: boolean }