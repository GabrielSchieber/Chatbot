import { expect, Page } from "@playwright/test"

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

export async function CreateTestUser(page: Page, user: User) {
    user.email = "test@example.com"
    user.password = "testpassword"
    user.chats = [{
        title: "Greetings",
        uuid: "",
        messages: [{
            text: "Hello!",
            is_from_user: true
        }, {
            text: "Hello! I'm here to help you with any questions or problems you might have. What's on your mind?",
            is_from_user: false
        }]
    }, {
        title: "What is Mathematics?",
        uuid: "",
        messages: [{
            text: "What is Mathematics? Describe it in one small phrase.",
            is_from_user: true
        }, {
            text: "Mathematics is the study of patterns and relationships that underlie all mathematical structures, from the smallest fractions to the most complex equations. It's about understanding how numbers work together to create order and harmony within the universe.",
            is_from_user: false
        }, {
            text: "Tell me about Number Theory in a few words.",
            is_from_user: true
        }, {
            text: "Number Theory is the branch of mathematics that deals with properties and relationships of integers, including divisibility, congruences, and Diophantine equations. It's an essential area of study for mathematicians seeking to understand the fundamental nature of numbers and their behavior under various transformations.",
            is_from_user: false
        }, {
            text: "Describe complex numbers in a few words.",
            is_from_user: true
        }, {
            text: "Complex numbers are mathematical objects that extend the real number system by introducing imaginary units, which allow us to represent quantities with both magnitude (length) and direction (angle). They play a crucial role in many areas of mathematics and physics, including electrical engineering, signal processing, and quantum mechanics.",
            is_from_user: false
        }]
    }]

    await RegisterUser(page, user)
}

async function setSeed(page: Page, seed: number) {
    const promptBar = page.getByTestId("prompt-bar")
    const dropdown = promptBar.getByRole("button").filter({ hasText: /^$/ })
    const optionsDropdown = promptBar.getByRole("button", { name: "Options" })
    const seedTextbox = promptBar.locator("div").filter({ hasText: /^🌱 Seed$/ }).getByRole("textbox")

    await dropdown.click()
    await optionsDropdown.click()
    await seedTextbox.click()
    await seedTextbox.fill(seed.toString())
    await seedTextbox.press("Enter")
    await optionsDropdown.click()
    await dropdown.click()
}

async function RegisterUser(page: Page, user: User) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")
    await page.waitForURL("/")

    const promptTextArea = page.getByPlaceholder("Ask me anything...")
    await expect(promptTextArea).toBeVisible()

    for (const chat of user.chats) {
        await page.getByTestId("new-chat").click()
        await page.waitForURL("/")
        await expect(promptTextArea).toBeVisible()

        function zipArrays<T, U>(arr1: T[], arr2: U[]): [T, U][] {
            return arr1.map((value, index) => [value, arr2[index]])
        }

        const userMessages = chat.messages.filter(m => m.is_from_user)
        const botMessages = chat.messages.filter(m => !m.is_from_user)

        let i = 0
        for (const [userMessage, botMessage] of zipArrays(userMessages, botMessages)) {
            await setSeed(page, 0)

            await promptTextArea.click()
            await promptTextArea.fill(userMessage.text)
            await promptTextArea.press("Enter")

            if (i === 0) {
                await page.waitForURL(url => url.pathname.includes("/chat/"))
                chat.uuid = page.url().split("/chat/")[1]

                await page.getByTestId(`history-dropdown-${chat.uuid}`).click()
                await page.getByTestId(`history-dropdown-rename-${chat.uuid}`).click()

                const chatRenameInput = page.getByTestId(`history-dropdown-rename-input-${chat.uuid}`)
                await chatRenameInput.click()
                await chatRenameInput.fill(chat.title)
                await chatRenameInput.press("Enter")
                await expect(page.getByRole("link", { name: chat.title })).toBeVisible()
            }

            await expect(page.getByTestId(`message-${i}`)).toHaveText(userMessage.text)
            await expect(page.getByTestId(`message-${i + 1}`)).toHaveText(botMessage.text)

            i += 2
        }
    }

    await page.getByText("Settings").click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("/login")
}

export type User = {
    email: string
    password: string
    chats: Chat[]
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