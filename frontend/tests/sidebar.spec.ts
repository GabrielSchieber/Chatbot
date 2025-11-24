import { expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

const toggleSidebarText = "Close Sidebar"
const newChatText = "New Chat"
const searchChatsText = "Search Chats"
const openSettingsText = "Settings"

test("user can see and toggle sidebar", async ({ page }) => {
    await signupAndLogin(page)

    const toggleSidebar = page.getByText(toggleSidebarText)
    const newChat = page.getByText(newChatText)
    const searchChats = page.getByText(searchChatsText)
    const openSettings = page.getByText(openSettingsText)

    async function checkVisibility(visible: boolean) {
        await expect(toggleSidebar).toBeVisible({ visible })
        await expect(newChat).toBeVisible({ visible })
        await expect(searchChats).toBeVisible({ visible })
        await expect(openSettings).toBeVisible({ visible })
    }

    await checkVisibility(true)
    await toggleSidebar.click()
    await checkVisibility(false)
    await page.getByRole("button").first().click()
    await checkVisibility(true)
})

test("user can see and toggle sidebar with chats", async ({ page }, testInfo) => {
    await signupAndLogin(page, true)

    const toggleSidebar = page.getByText(toggleSidebarText)
    const newChat = page.getByText(newChatText)
    const searchChats = page.getByText(searchChatsText)
    const openSettings = page.getByText(openSettingsText)

    async function checkVisibility(visible: boolean) {
        await expect(toggleSidebar).toBeVisible({ visible })
        await expect(newChat).toBeVisible({ visible })
        await expect(searchChats).toBeVisible({ visible })
        await expect(openSettings).toBeVisible({ visible })
    }

    await checkVisibility(true)
    await toggleSidebar.click()
    await checkVisibility(false)
    await page.getByRole("button").first().click()
    await checkVisibility(true)
})

test("user can rename chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    const chat = user.chats[0]
    const link = page.getByRole("link").nth(1)
    await expect(link).toContainText(chat.title)
    await expect(link.getByRole("button", { includeHidden: true })).toHaveCount(1)

    await link.hover()
    await link.getByRole("button").click()

    await page.getByRole("menuitem", { name: "Rename", exact: true }).click()

    const renameInput = page.locator("input[type='text']")
    await expect(renameInput).toBeVisible()
    await renameInput.fill("Renamed Chat")
    await renameInput.press("Enter")
    await expect(renameInput).not.toBeVisible()

    const renamedChatLink = page.getByRole("link", { name: "Renamed Chat", exact: true })
    await expect(renamedChatLink).toBeVisible()

    await page.reload()

    await expect(renamedChatLink).toBeVisible()
})

test("user can archive chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    const chat = user.chats[0]
    const link = page.getByRole("link", { name: chat.title })
    await expect(link.getByRole("button", { includeHidden: true })).toHaveCount(1)

    await link.hover()
    await link.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click()

    await expect(link).not.toBeVisible()
    await page.reload()
    await expect(link).not.toBeVisible()

    await page.getByText("Settings").click()
    await page.getByRole("tab", { name: "Data" }).click()
    await page.getByRole("button", { name: "Manage", exact: true }).click()

    await expect(page.getByRole("heading", { name: "Archived Chats", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: chat.title, exact: true })).toBeVisible()
})

test("user can delete chats", async ({ page }, testInfo) => {
    const user = await signupAndLogin(page, true)

    const chat = user.chats[0]
    const link = page.getByRole("link", { name: chat.title })
    await expect(link.getByRole("button", { includeHidden: true })).toHaveCount(1)

    if (!testInfo.project.use.isMobile) {
        await link.hover()
    }

    await link.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click()

    await expect(page.getByRole("heading", { name: "Delete Chat", exact: true })).toBeVisible()
    await expect(page.getByText(`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`, { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Delete", exact: true }).click()

    await expect(link).not.toBeVisible()
    await page.reload()
    await expect(link).not.toBeVisible()
})