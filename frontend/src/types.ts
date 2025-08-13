export type Chat = { title: string, is_complete: boolean, uuid: string }
export type Message = { text: string, files: { name: string }[], is_user_message: boolean }
export type SearchEntry = { title: string, matches: string[], uuid: string }
export type Model = "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B"