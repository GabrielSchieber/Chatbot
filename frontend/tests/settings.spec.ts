import test, { expect } from "@playwright/test"
import { signupAndLogin } from "./utils"

test("user can open settings", async ({ page }) => {
    const [email] = await signupAndLogin(page)

    await page.getByText("Settings").click()
    await expect(page.getByText(`Email: ${email}`, { exact: true })).toBeVisible()

    async function checkEntry(label: string, button: string) {
        await expect(page.locator("label").getByText(label, { exact: true })).toBeVisible()
        await expect(page.locator("button").getByText(button, { exact: true })).toBeVisible()
    }

    await checkEntry("Theme", "System")
    await checkEntry("Delete chats", "Delete all")
    await checkEntry("Delete account", "Delete")
    await checkEntry("Log out", "Log out")
})