import { expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

test("user can open settings", async ({ page }) => {
    const user = await signupAndLogin(page)

    await page.getByText("Settings").click()
    await expect(page.getByText(`Email: ${user.email}`, { exact: true })).toBeVisible()

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

    const darkResponse = page.waitForResponse(response => response.url().endsWith("/api/me/") && response.status() === 200)
    await darkOption.click()
    await darkResponse
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

    const lightResponse = page.waitForResponse(response => response.url().endsWith("/api/me/") && response.status() === 200)
    await lightOption.click()
    await lightResponse
    await expect(page.locator("button").getByText("Light")).toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")

    await page.reload()
    await waitForPageToLoad()
    await expect(page.locator("button").getByText("Light")).not.toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")

    await settingsButton.click()

    await page.locator("button").getByText("Light").click()

    const systemResponse = page.waitForResponse(response => response.url().endsWith("/api/me/") && response.status() === 200)
    await systemOption.click()
    await systemResponse
    await expect(page.locator("button").getByText("System")).toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")

    await page.reload()
    await waitForPageToLoad()
    await expect(page.locator("button").getByText("System")).not.toBeVisible()
    expect(await html.getAttribute("class")).toEqual("Light")
})

test("user can delete account", async ({ page }) => {
    const user = await signupAndLogin(page)

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