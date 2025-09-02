export type Chat = { title: string, is_complete: boolean, uuid: string }
export type Message = { text: string, files: MessageFile[], is_user_message: boolean }
export type MessageFile = { name: string, size: number }
export type SearchEntry = { title: string, matches: string[], uuid: string }
export type Model = "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream"
export type Options = { max_tokens: number, temperature: number, top_p: number, seed: number }
export type UIAttachment = {
    id: string
    file: File
    isRemoving: boolean
}