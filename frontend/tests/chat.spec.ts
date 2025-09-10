import { expect, Page, test } from "@playwright/test"
import { getRandomEmail } from "./utils"

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
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

    await signupAndLogin(page)
    await sendExampleMessage(page, 0)

    await page.locator(".flex.gap-1 > button:nth-child(2)").first().click()
    await expectClipboard(page, exampleMessages[0].user)
})

test("user can copy bot messages", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

    await signupAndLogin(page)
    await sendExampleMessage(page, 0)

    await page.locator(".flex.flex-col.gap-0\\.5.w-\\[50vw\\].justify-self-center.items-start > .flex > button").first().click();
    await expectClipboard(page, exampleMessages[0].bot)
})

test("user can edit their message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 1)

    await setSeed(page, 0)
    await page.locator(".p-2.rounded-lg").first().click()
    await page.getByText(exampleMessages[1].user).click()
    await page.getByText(exampleMessages[1].user).press("ArrowLeft")
    await page.getByText(exampleMessages[1].user).fill(exampleMessages[0].user)
    await page.getByRole("button", { name: "Send" }).click()

    await expect(page.getByTestId("message-0")).toHaveText(exampleMessages[0].user)
    await expect(page.getByTestId("message-1")).toHaveText(exampleMessages[0].bot)
})

test("user can regenerate messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleMessage(page, 0)
    await page.getByTestId("regenerate").click()
    await expect(page.getByTestId("message-1")).toHaveText("")
    await expect(page.getByTestId("message-1")).not.toHaveText(exampleMessages[0].bot)
})

const password = "testpassword"

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

async function signupAndLogin(page: Page) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")
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

async function sendMessage(page: Page, message: string, expectedResponse: string, seed?: number) {
    if (seed !== undefined) {
        await setSeed(page, seed)
    }

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter")

    await expect(page.getByText(message)).toBeVisible()
    await expect(page.getByText(expectedResponse)).toBeVisible()
}

async function sendExampleMessage(page: Page, index: number) {
    await sendMessage(page, exampleMessages[index].user, exampleMessages[index].bot, exampleMessages[index].seed)
}

async function expectClipboard(page: Page, expected: string) {
    page.evaluate(async _ => {
        expect(await navigator.clipboard.readText()).toBe(expected)
    })
}