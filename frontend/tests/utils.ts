import { Page, test as base } from "@playwright/test"
import { execSync } from "child_process"

export function apiFetch(url: string, init: RequestInit) {
    return fetch(`http://localhost:8000${url}`, init)
}

export function getRandomEmail() {
    return `user_${crypto.randomUUID()}@example.com`
}

export async function signupAndLogin(page: Page) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", "testpassword")

    await page.click("button")
    await page.waitForURL("/")
}

export type Message = {
    text: string
    is_from_user: boolean
}

export type Chat = {
    title: string
    uuid: string
    messages: Message[]
}

export type User = {
    email: string
    password: string
    chats: Chat[]
}

export type TestFixtures = { users: User[] }

export const test = base.extend<TestFixtures>({
    users: [
        async ({ }, use) => {
            const user1 = createUser("test1@example.com", "testpassword", [])
            const user2 = createUser(
                "test2@example.com",
                "testpassword",
                [{
                    title: "Greetings",
                    uuid: "",
                    messages: [{
                        text: "Hi!",
                        is_from_user: true
                    }, {
                        text: "Hello! How are you doing?",
                        is_from_user: false
                    }]
                }]
            )
            const user3 = createUser(
                "test3@example.com",
                "testpassword",
                [{
                    title: "What is Mathematics?",
                    uuid: "",
                    messages: [{
                        text: "Tell me about Mathematics.",
                        is_from_user: true
                    }, {
                        text: "Mathematics is...",
                        is_from_user: false
                    }]
                }, {
                    title: "Programming questions",
                    uuid: "",
                    messages: [{
                        text: "What are functions in programming?",
                        is_from_user: true
                    }, {
                        text: "In programming, functions are reusable pieces of code...",
                        is_from_user: false
                    }, {
                        text: "And what are variables?",
                        is_from_user: true
                    }, {
                        text: "Variables are used to store values...",
                        is_from_user: false
                    }]
                }]
            )
            await use([user1, user2, user3])
        },
        { scope: "worker", auto: true }
    ]
})

function createUser(email: string, password: string, chats: Chat[]): User {
    function executeBackendCommand(args: string[]): string {
        return execSync(`cd /app/backend && python manage.py ${args.join(" ")}`).toString().trim()
    }

    executeBackendCommand(["create_user", "--email", email, "--password", password])

    for (const chat of chats) {
        chat.uuid = executeBackendCommand(["create_chat", "--user-email", email, "--chat-title", `"${chat.title}"`])
        for (const message of chat.messages) {
            executeBackendCommand([
                "create_message", "--user-email", email, "--chat-uuid", chat.uuid,
                "--message-text", `"${message.text}"`, "--message-is-from-user", message.is_from_user ? "True" : "False"
            ])
        }
    }

    return { email, password, chats }
}