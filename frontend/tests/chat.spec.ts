import { Locator, Page, expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

test.describe.configure({ mode: "parallel" })

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        const store = { text: "" }

        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (t: string) => { store.text = t },
                readText: async () => store.text
            },
            configurable: true
        })
    })
})

test("user can chat with bot", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)
    await sendExampleChat(page, 1)
})

test("user can copy their own message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 1, 1)

    await page.getByTestId("copy").first().click()
    await expectClipboard(page, exampleChats[1].messagePairs[0].user)
})

test("user can copy bot messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 1, 1)

    const copyResponse = page.waitForResponse(response => response.url().endsWith("/api/get-message/") && response.status() === 200, { timeout })
    await page.getByTestId("copy").last().click()
    await copyResponse
    await expectClipboard(page, exampleChats[1].messagePairs[0].bot)
})

test("user can edit their message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const userMessage = exampleChats[0].messagePairs[0].user
    const botMessage = exampleChats[0].messagePairs[0].bot

    await setOptions(page, options)
    await page.getByTestId("edit").click()
    const userMessageTextArea = page.getByText(userMessage, { exact: true })
    await userMessageTextArea.click()
    await userMessageTextArea.press("ArrowLeft")
    await userMessageTextArea.fill(userMessage)
    await page.getByRole("button", { name: "Send" }).click()

    await expect(page.getByTestId("message-0")).toHaveText(userMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(botMessage, { timeout })
})

test("user can regenerate messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    await page.getByTestId("regenerate").click()

    const regenerateDropdown = page.getByTestId("regenerate-dropdown")
    await expect(regenerateDropdown).toBeVisible()

    const regenerateDropdownEntries = regenerateDropdown.getByTestId("regenerate-dropdown-entry")
    await expect(regenerateDropdownEntries).toHaveCount(4)

    await regenerateDropdownEntries.first().click()

    await expect(page.getByTestId("message-1")).not.toHaveText(exampleChats[0].messagePairs[0].bot, { timeout })
})

test("user can delete chats", async ({ page }) => {
    await signupAndLogin(page)

    await sendExampleChat(page, 0)
    await sendExampleChat(page, 1)

    await expect(page.getByRole("link")).toHaveCount(3)
    for (const chat of exampleChats) {
        await expect(page.getByRole("link", { name: chat.title, exact: true })).toBeVisible()
    }
    await page.goto("/")

    await page.getByText("Settings").click()

    const deleteChats = page.getByRole("button", { name: "Delete all", exact: true })
    await expect(deleteChats).toBeVisible()

    await deleteChats.click()

    const confirmDialogTitle = page.getByRole("heading", { name: "Delete Chats", exact: true })
    await expect(confirmDialogTitle).toBeVisible()

    const confirmDialog = confirmDialogTitle.locator("..")
    await expect(confirmDialog).toBeVisible()

    await expect(confirmDialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible()
    await confirmDialog.getByRole("button", { name: "Delete all", exact: true }).click()
    await expect(confirmDialogTitle).not.toBeVisible()
    await expect(confirmDialog).not.toBeVisible()

    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Settings" })).not.toBeVisible()
    await expect(deleteChats).toBeVisible()

    await page.getByTestId("close-settings").click()
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()

    await expect(page.getByRole("link")).toHaveCount(1, { timeout: 30000 })
    for (const chat of exampleChats) {
        await expect(page.getByRole("link", { name: chat.title, exact: true })).not.toBeVisible()
    }
})

test("user can create new chat", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    expect(page.url()).toContain("/chat/")
    await page.getByText("New Chat").click()
    await page.waitForURL("/")

    await expect(page.getByTestId("message-0")).not.toBeVisible({ timeout })
    await expect(page.getByTestId("message-1")).not.toBeVisible({ timeout })
    await sendExampleChat(page, 1, 1)
})

type Options = {
    maxTokens: number
    temperature: number
    topP: number
    seed: number
}

type MessagePair = {
    user: string
    bot: string
    options: Options
}

type Chat = {
    title: string
    messagePairs: MessagePair[]
}

const timeout = 30000

const options = {
    maxTokens: 150,
    temperature: 0.1,
    topP: 0.1,
    seed: 0
}

const exampleChats: Chat[] = [{
    title: "Greetings",
    messagePairs: [{
        user: "Hello!",
        bot: "Hello! I'm here to help you with any questions or problems you might have. Whether it's about math, science, history, or anything else, I'll do my best to provide clear and concise explanations. What's on your mind?",
        options
    }]
}, {
    title: "Weather Inquiry",
    messagePairs: [{
        user: "What's the weather like today?",
        bot: "The weather is quite pleasant. It's been mostly sunny and clear for most of the day, with some scattered clouds rolling in from the west. The sky is currently a pale orange color, which suggests it might be a warm day to enjoy. There are no significant wind gusts or rain showers expected today, so you can focus on enjoying your outdoor activities without worrying about any potential weather issues.",
        options
    }, {
        user: "And what is it going to be like tomorrow?",
        bot: "Tomorrow's forecast looks quite promising for the next few days. The sun will continue to shine brightly, and there won't be much cloud cover in the afternoon. The temperature might drop slightly later on, but overall, it should be a pleasant day with some sunshine. There are no significant weather issues expected today, so you can focus on enjoying your outdoor activities without worrying about any potential problems.",
        options
    }]
}]

async function setOptions(page: Page, options: Options) {
    const promptBar = page.getByTestId("prompt-bar")
    const promptBarDiv = promptBar.locator("div")

    const dropdown = promptBar.getByTestId("add-dropdown")
    const optionsDropdown = promptBar.getByRole("button", { name: "Options" })

    await dropdown.click()
    await optionsDropdown.click()

    const maxTokensTextBox = promptBarDiv.filter({ hasText: /^🔣 Max. Tokens$/ }).getByRole("textbox")
    const temperatureTextBox = promptBarDiv.filter({ hasText: /^🌡 Temperature$/ }).getByRole("textbox")
    const topPTextBox = promptBarDiv.filter({ hasText: /^⬆ Top P$/ }).getByRole("textbox")
    const seedTextBox = promptBarDiv.filter({ hasText: /^🌱 Seed$/ }).getByRole("textbox")

    async function fill(locator: Locator, value: number) {
        await locator.click()
        await locator.fill(value.toString())
        await locator.press("Enter")
    }

    await fill(maxTokensTextBox, options.maxTokens)
    await fill(temperatureTextBox, options.temperature)
    await fill(topPTextBox, options.topP)
    await fill(seedTextBox, options.seed)

    await optionsDropdown.click()
    await dropdown.click()
}

async function sendMessage(page: Page, index: number, message: string, expectedResponse: string, options?: { maxTokens: number, temperature: number, topP: number, seed: number }) {
    if (options !== undefined) {
        await setOptions(page, options)
    }

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter")

    const userMessage = page.getByTestId(`message-${index}`)
    const botMessage = page.getByTestId(`message-${index + 1}`)

    await expect(userMessage).toBeVisible({ timeout })
    await expect(botMessage).toBeVisible({ timeout })

    await expect(userMessage).toContainText(message, { timeout })
    await expect(botMessage).toContainText(expectedResponse, { timeout })
}

async function sendExampleChat(page: Page, index: number, messagePairs?: number) {
    const chat = exampleChats[index]
    const pairs = chat.messagePairs.slice(0, messagePairs)

    await page.goto("/")

    let i = 0
    for (const [pair, index] of pairs.map<[MessagePair, number]>((p, i) => [p, i])) {
        await sendMessage(page, i, pair.user, pair.bot, pair.options)
        i += 2

        if (index === 0) {
            const chatsInHistory = await page.locator("div.history-entries > *").count()
            const chatAnchor = page.getByRole("link", { name: `Chat ${chatsInHistory}` })
            const chatUUID = (await chatAnchor.getAttribute("href"))!.split("/chat/")[1]
            await expect(chatAnchor).toBeVisible()
            const dropdown = chatAnchor.locator("..")
            await dropdown.locator("button").click()
            await page.getByTestId(`history-dropdown-rename-${chatUUID}`).click()
            const input = page.getByTestId(`history-dropdown-rename-input-${chatUUID}`)
            await input.fill(chat.title)
            await input.press("Enter")
        }
    }
}

async function expectClipboard(page: Page, expected: string) {
    expect(await page.evaluate(_ => navigator.clipboard.readText())).toEqual(expected)
}