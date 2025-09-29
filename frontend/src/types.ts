export type Model = "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream"
export type Options = { num_predict: number, temperature: number, top_p: number, seed?: number }
export type Theme = "System" | "Light" | "Dark"

export type User = { id: number, email: string, theme: Theme, has_sidebar_open: boolean }

export type Chat = { title: string, pending_message_id: number | null, uuid: string }

export type Message = { id: number, text: string, is_from_user: boolean, files: MessageFile[], model: Model | undefined }
export type MessageFile = { id: number, name: string, content_size: number, content_type: string }

export type SearchEntry = { title: string, matches: string[], uuid: string }

export type UIAttachment = { messageFile: MessageFile, isBeingRemoved: boolean, isNew: boolean }