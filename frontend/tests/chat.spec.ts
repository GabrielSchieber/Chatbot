import { expect, test } from "@playwright/test"
import { getRandomEmail } from "./utils"

const password = "testpassword"

test("user can chat with bot", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill("Hello!")
    await textarea.press("Enter")
    await expect(page.locator("#root")).toContainText("Hello! What's up? How can I help you today?")
    await expect(page.locator("#root")).toContainText("Hello!")
    await expect(page.locator("#root")).toContainText("Chat 1")
    await expect(page.getByRole("link", { name: "Chat 1" })).toBeVisible()
})