import { expect, test } from "@playwright/test"
import { setUp, signupAndLogin } from "./utils"

setUp()

test("user can chat with bot", async ({ page }) => {
    await signupAndLogin(page)
    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.click()
    await textarea.fill("Hello!")
    await textarea.press("Enter")
    await expect(page.locator("#root")).toContainText("Hello! What's up? How can I help you today?")
    await expect(page.locator("#root")).toContainText("Hello!")
    await expect(page.locator("#root")).toContainText("Chat 1")
    await expect(page.getByRole("link", { name: "Chat 1" })).toBeVisible()
})