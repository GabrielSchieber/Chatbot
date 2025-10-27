import { Page, expect, test } from "@playwright/test"
import { authenticator } from "otplib"
import { Chat, User, signupAndLogin, signupWithMFAEnabledAndLogin, apiFetch } from "./utils"

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

test("user can archive all chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)
    await archiveOrUnarchiveAllChats(page, user, "archive", false)
})

test("user can unarchive all chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)
    await archiveOrUnarchiveAllChats(page, user, "archive", false)
    await page.reload()
    await archiveOrUnarchiveAllChats(page, user, "unarchive", true)
})

test("user can unarchive specific chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)
    await archiveOrUnarchiveAllChats(page, user, "archive", false)

    const archivedEntries = page.getByTestId("archived-chats").locator("a")
    const historyEntries = page.getByTestId("history").locator("a")

    async function unarchive(index: number, chat: Chat, expectedArchivedEntries: number, expectedHistoryEntries: number) {
        await expect(archivedEntries).toHaveCount(expectedArchivedEntries)
        await expect(historyEntries).toHaveCount(expectedHistoryEntries)

        await expect(archivedEntries.nth(index)).toHaveText(chat.title)
        expect(await archivedEntries.nth(index).getAttribute("href")).toEqual(`/chat/${chat.uuid}`)

        await archivedEntries.nth(index).getByRole("button").first().click()

        await expect(historyEntries).toHaveCount(expectedHistoryEntries + 1)
        await expect(archivedEntries).toHaveCount(expectedArchivedEntries - 1)
    }

    await unarchive(0, user.chats[0], user.chats.length, 0)
    await unarchive(3, user.chats[4], user.chats.length - 1, 1)
    await unarchive(7, user.chats[9], user.chats.length - 2, 2)
    await unarchive(2, user.chats[3], user.chats.length - 3, 3)
})

test("user can delete specific archived chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)
    await archiveOrUnarchiveAllChats(page, user, "archive", false)

    const archivedEntries = page.getByTestId("archived-chat-entry")
    const historyEntries = page.getByTestId("history-entry")

    async function deleteArchivedChat(index: number, chat: Chat, expectedArchivedEntries: number) {
        await expect(archivedEntries).toHaveCount(expectedArchivedEntries)
        await expect(historyEntries).toHaveCount(0)

        await expect(archivedEntries.nth(index)).toHaveText(chat.title)
        expect(await archivedEntries.nth(index).getAttribute("href")).toEqual(`/chat/${chat.uuid}`)

        await archivedEntries.nth(index).getByRole("button").last().click()

        const heading = page.getByRole("heading", { name: "Delete Archived Chat", exact: true })
        await expect(heading).toBeVisible()

        const dialog = heading.locator("..")
        await expect(dialog.getByText(`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`, { exact: true })).toBeVisible()

        await expect(dialog.getByRole("button")).toHaveCount(2)
        await expect(dialog.getByRole("button").first()).toHaveText("Cancel")
        await dialog.getByRole("button", { name: "Delete", exact: true }).click()

        await expect(heading).not.toBeVisible()

        await expect(historyEntries).toHaveCount(0)
        await expect(archivedEntries).toHaveCount(expectedArchivedEntries - 1)
    }

    await deleteArchivedChat(0, user.chats[0], user.chats.length)
    await deleteArchivedChat(3, user.chats[4], user.chats.length - 1)
    await deleteArchivedChat(7, user.chats[9], user.chats.length - 2)
    await deleteArchivedChat(2, user.chats[3], user.chats.length - 3)
})

test("user can delete account", async ({ page }) => {
    const user = await signupAndLogin(page)

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Delete", exact: true }).click()

    const confirmDialogTitle = page.getByRole("heading", { name: "Delete Account", exact: true })
    await expect(confirmDialogTitle).toBeVisible()

    // find the dialog container and ensure action buttons are visible
    const confirmDialog = page.getByRole("dialog", { name: "Delete Account", exact: true })
    await expect(confirmDialog).toBeVisible()

    await expect(confirmDialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible()

    // fill required password (and MFA if needed) before confirming
    const passwordInput = confirmDialog.locator("input[type='password']")
    await passwordInput.fill(user.password)

    await confirmDialog.getByRole("button", { name: "Delete Account", exact: true }).click()
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)
    await page.click("button")

    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user can delete account with MFA enabled", async ({ page }) => {
    const { user } = await signupWithMFAEnabledAndLogin(page)

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Delete", exact: true }).click()

    const confirmDialog = page.getByRole("dialog", { name: "Delete Account", exact: true })
    await expect(confirmDialog).toBeVisible()

    // fill password
    await confirmDialog.locator("input[type='password']").fill(user.password)

    // fetch secret and generate current TOTP code
    const response = await apiFetch(`/test/get-mfa-secret/?email=${user.email}`, {})
    expect(response.status).toBe(200)
    const secret = await response.json()
    const code = authenticator.generate(secret)

    // fill MFA code field and confirm
    await confirmDialog.getByPlaceholder("MFA code").fill(code)
    await confirmDialog.getByRole("button", { name: "Delete Account", exact: true }).click()

    await page.waitForURL("/login")

    // ensure account was deleted (cannot log in)
    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)
    await page.click("button")
    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user can delete account with an MFA backup code", async ({ page }) => {
    const { user, backupCodes } = await signupWithMFAEnabledAndLogin(page)

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Delete", exact: true }).click()

    const confirmDialog = page.getByRole("dialog", { name: "Delete Account", exact: true })
    await expect(confirmDialog).toBeVisible()

    // fill password
    await confirmDialog.locator("input[type='password']").fill(user.password)

    // fill backup code (first one) and confirm
    await confirmDialog.getByPlaceholder("MFA code").fill(backupCodes[0])
    await confirmDialog.getByRole("button", { name: "Delete Account", exact: true }).click()

    await page.waitForURL("/login")

    // ensure account was deleted (cannot log in)
    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)
    await page.click("button")
    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user cannot delete account with an invalid MFA code", async ({ page }) => {
    const { user } = await signupWithMFAEnabledAndLogin(page)

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Delete", exact: true }).click()
    const confirmDialog = page.getByRole("dialog", { name: "Delete Account", exact: true })

    await expect(confirmDialog).toBeVisible()

    // fill password and an invalid MFA code
    await confirmDialog.locator("input[type='password']").fill(user.password)
    await confirmDialog.getByPlaceholder("MFA code").fill("000000")
    await confirmDialog.getByRole("button", { name: "Delete Account", exact: true }).click()

    // deletion should fail: dialog remains (no redirect to /login)
    await expect(confirmDialog).toBeVisible()
    await expect(confirmDialog.getByText("Invalid MFA code.", { exact: true })).toBeVisible({ timeout: 15_000 })
})

test("user cannot delete account with a used MFA backup code", async ({ page }) => {
    test.setTimeout(60_000)
    const { user, backupCodes } = await signupWithMFAEnabledAndLogin(page)

    // log out so we can consume a backup code via the login flow
    await page.getByTestId("open-settings").click()
    await page.getByRole("button", { name: "Log out", exact: true }).click()
    await page.waitForURL("/login")

    // perform login with a recovery code (this will consume the first backup code)
    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)
    await page.click("button")

    await expect(page.getByText("Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter the 6-digit code from your authenticator app", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Use recovery code", exact: true }).click()
    await expect(page.getByText("Recover Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter one of your recovery code", { exact: true })).toBeVisible()

    await page.fill("input", backupCodes[0])
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page.getByRole("button", { name: "Verifying", exact: true })).toBeVisible()
    await page.waitForURL("/")

    // we're now logged in and the first backup code was consumed
    // attempt to delete using the same (used) backup code
    await page.getByText("Settings").click()
    // small pause to ensure auth state and UI settled
    await page.waitForTimeout(500)
    await page.getByRole("button", { name: "Delete", exact: true }).click()

    const confirmDialog = page.getByRole("dialog", { name: "Delete Account", exact: true })
    await expect(confirmDialog).toBeVisible()

    // fill password and the already-used backup code
    await confirmDialog.locator("input[type='password']").fill(user.password)
    await confirmDialog.getByPlaceholder("MFA code").fill(backupCodes[0])
    await confirmDialog.getByRole("button", { name: "Delete Account", exact: true }).click()

    // deletion should fail: dialog remains (no redirect to /login)
    await expect(confirmDialog).toBeVisible()

    // cleanup: cancel and ensure account still exists by logging out and logging back in
    await confirmDialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await page.getByRole("button", { name: "Log out", exact: true }).click()
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)
    await page.click("button")

    // Try to login; either the app will prompt for MFA or will directly sign-in.
    // First, try a quick redirect to "/". If that doesn't happen, complete MFA with the next backup code.
    try {
        await page.waitForURL("/", { timeout: 2000 })
    } catch (e) {
        // MFA required — complete with next backup code
        await expect(page.getByText("Multi-Factor Authentication", { exact: true })).toBeVisible()
        await page.getByRole("button", { name: "Use recovery code", exact: true }).click()
        await expect(page.getByText("Recover Multi-Factor Authentication", { exact: true })).toBeVisible()
        await page.fill("input", backupCodes[1])
        await page.getByRole("button", { name: "Verify", exact: true }).click()
        await expect(page.getByRole("button", { name: "Verifying", exact: true })).toBeVisible()
        await page.waitForURL("/")
    }
})

test("user can log out", async ({ page }) => {
    await signupAndLogin(page)
    await page.getByText("Settings").click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("/login")
    await page.goto("/")
    await page.waitForURL("/login")
})

async function archiveOrUnarchiveAllChats(page: Page, user: User, action: "archive" | "unarchive", shouldHaveChats: boolean) {
    const label = action === "archive" ? "Archive" : "Unarchive"

    const initialHistoryCount = action === "archive" ? user.chats.length : 0
    const initialArchivedCount = action === "archive" ? 0 : user.chats.length

    await expect(page.getByTestId("history").locator("a")).toHaveCount(initialHistoryCount)

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Manage", exact: true }).click()

    if (shouldHaveChats) {
        await expect(page.getByText("You don't have any archived chats.")).not.toBeVisible()
        await expect(page.getByText("Loading...")).not.toBeVisible()
    }
    await page.getByTestId("archived-chats").evaluate((element: HTMLElement) => element.scrollTop = element.scrollHeight)

    await expect(page.getByTestId("archived-chats").locator("a")).toHaveCount(initialArchivedCount)

    await expect(page.getByRole("heading", { name: "Archived Chats", exact: true })).toBeVisible()
    if (initialArchivedCount === 0) {
        await expect(page.getByText("You don't have any archived chats.", { exact: true })).toBeVisible()
    }

    await page.getByRole("button", { name: `${label} all`, exact: true }).click()
    await expect(page.getByRole("heading", { name: `${label} all chats`, exact: true })).toBeVisible()
    await expect(page.getByText(`Are you sure you want to ${label.toLowerCase()} all of your chats?`, { exact: true })).toBeVisible()

    await page.getByRole("button", { name: label + " all", exact: true }).click()

    await expect(page.getByText("You don't have any archived chats.")).not.toBeVisible()
    await expect(page.getByText("Loading...")).not.toBeVisible()
    await page.getByTestId("archived-chats").evaluate((element: HTMLElement) => element.scrollTop = element.scrollHeight)

    await expect(page.getByTestId("history").locator("a")).toHaveCount(initialArchivedCount)
    await expect(page.getByTestId("archived-chats").locator("a")).toHaveCount(initialHistoryCount)
}