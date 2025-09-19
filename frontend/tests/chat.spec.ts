import { Page, expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

const timeout = 30000

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
    await sendExampleMessage(page, 0)
    await expect(page.getByRole("link", { name: "Chat 1" })).toBeVisible()
})

test("user can chat with bot multiple times", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 2)
    await sendExampleMessage(page, 3)
})

test("user can copy their own message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 0)

    await page.getByTestId("copy").first().click()
    await expectClipboard(page, exampleMessages[0].user)
})

test("user can copy bot messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 0)

    await page.getByTestId("copy").last().click()
    await page.waitForResponse(response => response.url().endsWith("/api/get-message/") && response.status() === 200, { timeout })
    await expectClipboard(page, exampleMessages[0].bot)
})

test("user can edit their message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 1)

    await setSeed(page, 0)
    await page.getByTestId("edit").click()
    await page.getByText(exampleMessages[1].user).click()
    await page.getByText(exampleMessages[1].user).press("ArrowLeft")
    await page.getByText(exampleMessages[1].user).fill(exampleMessages[0].user)
    await page.getByRole("button", { name: "Send" }).click()

    await expect(page.getByTestId("message-0")).toHaveText(exampleMessages[0].user, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(exampleMessages[0].bot, { timeout })
})

test("user can regenerate messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 0)

    await page.getByTestId("regenerate").click()

    const regenerateDropdown = page.getByTestId("regenerate-dropdown")
    await expect(regenerateDropdown).toBeVisible()

    const regenerateDropdownEntries = regenerateDropdown.getByTestId("regenerate-dropdown-entry")
    await expect(regenerateDropdownEntries).toHaveCount(4)

    await regenerateDropdownEntries.first().click()

    await expect(page.getByTestId("message-1")).not.toHaveText(exampleMessages[0].bot, { timeout })
})

test("user can delete chats", async ({ page }) => {
    await signupAndLogin(page)

    await sendExampleMessage(page, 0)
    await page.goto("/")
    await sendExampleMessage(page, 1)
    await page.goto("/")
    await sendExampleMessage(page, 2)
    await page.goto("/")

    await expect(page.getByRole("link")).toHaveCount(4)
    for (let i = 1; i <= 3; i++) {
        await expect(page.getByRole("link", { name: `Chat ${i}`, exact: true })).toBeVisible()
    }

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
    for (let i = 1; i <= 3; i++) {
        await expect(page.getByRole("link", { name: `Chat ${i}`, exact: true })).not.toBeVisible()
    }
})

test("user can create new chat", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 1)

    expect(page.url()).toContain("/chat/")
    await page.getByText("New Chat").click()
    await page.waitForURL("/")

    await expect(page.getByTestId("message-0")).not.toBeVisible({ timeout })
    await expect(page.getByTestId("message-1")).not.toBeVisible({ timeout })
    await sendExampleMessage(page, 0)
})

const exampleMessages: { user: string, bot: string, seed: number }[] = [
    {
        user: "Hello!",
        bot: "Hello! I'm here to help you with any questions or problems you might have. What's on your mind?",
        seed: 0
    },
    {
        user: "Hi!",
        bot: "Hello! How can I help you today?",
        seed: 0
    },
    {
        user: "What is Mathematics? Describe it in ten words.",
        bot: "Mathematics is the study of patterns and relationships within numbers, shapes, and spaces. It involves using mathematical concepts to describe and analyze these phenomena.",
        seed: 0
    },
    {
        user: "What is Geometry? Describe it in ten words.",
        bot: "Geometry is the branch of mathematics that deals with the study of shapes, sizes, positions, and angles in space. It uses geometric principles like points, lines, planes, and solids to understand and describe the world around us.",
        seed: 0
    }
]

async function setSeed(page: Page, seed: number) {
    const promptBar = page.getByTestId("prompt-bar")
    const dropdown = promptBar.getByTestId("add-dropdown")
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

async function sendMessage(page: Page, message: string, expectedResponse: string, seed?: number) {
    if (seed !== undefined) {
        await setSeed(page, seed)
    }

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter")

    await expect(page.getByText(message)).toBeVisible({ timeout })
    await expect(page.getByText(expectedResponse)).toBeVisible({ timeout })
}

async function sendExampleMessage(page: Page, index: number) {
    await sendMessage(page, exampleMessages[index].user, exampleMessages[index].bot, exampleMessages[index].seed)
}

async function expectClipboard(page: Page, expected: string) {
    expect(await page.evaluate(_ => navigator.clipboard.readText())).toEqual(expected)
}