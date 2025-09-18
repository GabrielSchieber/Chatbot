// @ts-ignores
import { readFileSync } from "node:fs"
import { Page } from "@playwright/test"

export function apiFetch(url: string, init: RequestInit) {
    return fetch(`http://localhost:8000${url}`, init)
}

export function getRandomEmail() {
    return `user_${crypto.randomUUID()}@example.com`
}

export async function signupAndLogin(page: Page) {
    const email = getRandomEmail()
    const password = "testpassword"

    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")

    return [email, password]
}

export async function loginWithTestUser(page: Page) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")
    await page.waitForURL("/")

    return user
}

export type User = {
    email: string
    password: string
    chats: Chat[]
}

export type Chat = {
    title: string
    uuid: string
    messages: Message[]
}

export type Message = {
    text: string
    is_from_user: boolean
}

const user: User = (() => {
    const data = JSON.parse(readFileSync("frontend/tests/fixture.json", "utf-8"))

    let email
    for (const entry of data) {
        if (entry.model === "chat.user") {
            email = entry.fields.email
            break
        }
    }
    if (typeof email !== "string") {
        throw new Error("Fixture didn't contain any users")
    }

    let chats: Chat[] = []
    for (const entry of data) {
        if (entry.model === "chat.chat") {
            const uuid = entry.pk
            let messages: Message[] = []
            for (const entry of data) {
                if (entry.model === "chat.message" && entry.fields.chat === uuid) {
                    messages.push({ text: entry.fields.text, is_from_user: entry.fields.is_from_user })
                }
            }
            chats.push({ title: entry.fields.title, uuid, messages })
        }
    }
    chats.reverse()

    return { email, password: "testpassword", chats }
})()