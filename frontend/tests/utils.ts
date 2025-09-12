import { Page } from "@playwright/test"
import { execSync } from "child_process"

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

export async function createTestUser(page: Page): Promise<User> {
    const email = getRandomEmail()
    const password = "testpassword"
    const chats: Chat[] = [{
        title: "Greetings",
        uuid: "",
        messages: [{
            text: "Hello!",
            is_from_user: true
        }, {
            text: "Hello! How are you?",
            is_from_user: false
        }]
    }]

    function executeCommand(args: string) {
        return execSync(`cd /app/backend && python manage.py ${args}`)
    }

    executeCommand(`create_user --email ${email} --password ${password}`)

    for (const chat of chats) {
        chat.uuid = executeCommand(`create_chat --user-email ${email} --chat-title "${chat.title}"`).toString().trim()
        for (const message of chat.messages) {
            executeCommand(`create_message --user-email ${email} --chat-uuid "${chat.uuid}" --message-text "${message.text}" --message-is-from-user ${message.is_from_user ? "True" : "False"}`)
        }
    }

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")

    return { email, password, chats }
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