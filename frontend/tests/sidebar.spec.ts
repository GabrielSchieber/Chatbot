import { expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

const toggleSidebarText = "Close Sidebar"
const newChatText = "New Chat"
const searchChatsText = "Search Chats"
const openSettingsText = "Settings"

test("user can see and toggle sidebar", async ({ page }) => {
    await signupAndLogin(page)

    const toggleSidebar = page.getByTestId("toggle-sidebar")
    const newChat = page.getByTestId("new-chat")
    const searchChats = page.getByTestId("search-chats")
    const openSettings = page.getByTestId("open-settings")

    await expect(toggleSidebar).toBeVisible()
    await expect(newChat).toBeVisible()
    await expect(searchChats).toBeVisible()
    await expect(openSettings).toBeVisible()

    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(searchChats).toContainText(searchChatsText)
    await expect(openSettings).toContainText(openSettingsText)

    await toggleSidebar.click()
    await expect(toggleSidebar).not.toContainText(toggleSidebarText)
    await expect(newChat).not.toContainText(newChatText)
    await expect(searchChats).not.toContainText(searchChatsText)
    await expect(openSettings).not.toContainText(openSettingsText)

    await toggleSidebar.click()
    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(searchChats).toContainText(searchChatsText)
    await expect(openSettings).toContainText(openSettingsText)
})

test("user can see and toggle sidebar with chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    const toggleSidebar = page.getByTestId("toggle-sidebar")
    const newChat = page.getByTestId("new-chat")
    const searchChats = page.getByTestId("search-chats")
    const openSettings = page.getByTestId("open-settings")

    await expect(toggleSidebar).toBeVisible()
    await expect(newChat).toBeVisible()
    await expect(searchChats).toBeVisible()
    await expect(openSettings).toBeVisible()

    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(searchChats).toContainText(searchChatsText)
    await expect(openSettings).toContainText(openSettingsText)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title })).toBeVisible()
    }

    await toggleSidebar.click()
    await expect(toggleSidebar).not.toContainText(toggleSidebarText)
    await expect(newChat).not.toContainText(newChatText)
    await expect(searchChats).not.toContainText(searchChatsText)
    await expect(openSettings).not.toContainText(openSettingsText)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title })).not.toBeVisible()
    }

    await toggleSidebar.click()
    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(searchChats).toContainText(searchChatsText)
    await expect(openSettings).toContainText(openSettingsText)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title })).toBeVisible()
    }
})

test("user can rename chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    const firstChat = user.chats[0]
    const firstChatLink = page.getByRole("link", { name: firstChat.title, exact: true })

    await firstChatLink.hover()
    await firstChatLink.getByRole("button").click()

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
    const link = page.getByRole("link", { name: chat.title, exact: true })

    await link.hover()
    await link.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click()

    await expect(link).not.toBeVisible()

    await page.reload()

    await expect(link).not.toBeVisible()

    await page.getByText("Settings").click()

    await page.getByRole("button", { name: "Manage", exact: true }).click()

    await expect(page.getByRole("heading", { name: "Archived Chats", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: chat.title, exact: true })).toBeVisible()
})

test("user can delete chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    const firstChat = user.chats[0]
    const firstChatLink = page.getByRole("link", { name: firstChat.title, exact: true })

    await firstChatLink.hover()
    await firstChatLink.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click()

    await expect(page.getByRole("heading", { name: "Delete Chat", exact: true })).toBeVisible()
    await expect(page.getByText(`Are you sure you want to delete "${firstChat.title}"? This action cannot be undone.`, { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Delete", exact: true }).click()

    await expect(firstChatLink).not.toBeVisible()

    await page.reload()

    await expect(firstChatLink).not.toBeVisible()
})