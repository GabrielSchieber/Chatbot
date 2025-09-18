import { expect, test } from "@playwright/test"
import { loginWithTestUser, signupAndLogin } from "./utils"

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

test("user can change theme", async ({ page }) => {
    await signupAndLogin(page)

    async function waitForPageToLoad() {
        await expect(page.getByText("You don't have any chats")).toBeVisible()
    }

    await waitForPageToLoad()

    const html = page.locator("html")

    expect(await html.getAttribute("class")).toEqual("Light")

    const settingsButton = page.getByText("Settings")
    await settingsButton.click()

    await page.locator("button").getByText("System").click()

    const systemOption = page.getByLabel("System").getByText("System")
    const lightOption = page.getByLabel("Light").getByText("Light")
    const darkOption = page.getByLabel("Dark").getByText("Dark")

    await expect(systemOption).toBeVisible()
    await expect(lightOption).toBeVisible()
    await expect(darkOption).toBeVisible()

    await darkOption.click()
    await expect(page.locator("button").getByText("Dark")).toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Dark")

    await page.reload()
    await waitForPageToLoad()
    await expect(page.locator("button").getByText("Dark")).not.toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Dark")

    await settingsButton.click()

    await page.locator("button").getByText("Dark").click()

    await expect(systemOption).toBeVisible()
    await expect(lightOption).toBeVisible()
    await expect(darkOption).toBeVisible()

    await lightOption.click()
    await expect(page.locator("button").getByText("Light")).toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")

    await page.reload()
    await waitForPageToLoad()
    await expect(page.locator("button").getByText("Light")).not.toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")

    await settingsButton.click()

    await page.locator("button").getByText("Light").click()

    await systemOption.click()
    await expect(page.locator("button").getByText("System")).toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")

    await page.reload()
    await waitForPageToLoad()
    await expect(page.locator("button").getByText("System")).not.toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")
})

test("user can delete chats", async ({ page }) => {
    const user = await loginWithTestUser(page)

    await expect(page.getByRole("link")).toHaveCount(1 + user.chats.length)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title, exact: true })).toBeVisible()
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

    await expect(page.getByRole("link")).toHaveCount(1)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title, exact: true })).not.toBeVisible()
    }
})

test("user can delete account", async ({ page }) => {
    const user = await loginWithTestUser(page)

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Delete", exact: true }).click()

    const confirmDialogTitle = page.getByRole("heading", { name: "Delete Account", exact: true })
    await expect(confirmDialogTitle).toBeVisible()

    const confirmDialog = confirmDialogTitle.locator("..")
    await expect(confirmDialog).toBeVisible()

    await expect(confirmDialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible()
    await confirmDialog.getByRole("button", { name: "Delete Account", exact: true }).click()
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")

    await page.click("button")
    await expect(page.getByRole("paragraph"), { message: "Email and/or password are invalid." }).toBeVisible()
})

test("user can log out", async ({ page }) => {
    await signupAndLogin(page)
    await page.getByText("Settings").click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("/login")
    await page.goto("/")
    await page.waitForURL("/login")
})