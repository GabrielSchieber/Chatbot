// @ts-ignores
import { readFileSync } from "node:fs"
import { Page, test as base, expect } from "@playwright/test"

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
    await waitForIndexPageToload(page, [])

    return [email, password]
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

export const test = base.extend<{ user: User }>({
    user: [async ({ page }, use) => {
        await loginWithTestUser(page)
        await use(user)
    }, { scope: "test", auto: true }]
})

async function loginWithTestUser(page: Page) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")
    await page.waitForURL("/")
    await waitForIndexPageToload(page, user.chats)
}

async function waitForIndexPageToload(page: Page, chats: Chat[]) {
    const historyPanel = page.locator("div[class~='history-entries']").locator("..")
    await expect(historyPanel).toBeVisible()
    await expect(historyPanel).not.toContainText("Loading ...")
    if (chats.length === 0) {
        const paragraph = historyPanel.getByRole("paragraph")
        await expect(paragraph).toHaveText(["Chats", "You don't have any chats"])
    } else {
        const anchors = historyPanel.getByRole("link")
        await expect(anchors).toHaveText(chats.slice(0, Math.min(chats.length, 25)).map(c => c.title))
    }
}

const user: User = (() => {
    let data
    try {
        data = readFileSync("tests/fixture.json", "utf-8")
    } catch {
        try {
            data = readFileSync("frontend/tests/fixture.json", "utf-8")
        } catch {
            throw new Error("Could not read fixture.json file")
        }
    }
    data = JSON.parse(data)

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