import { expect, test } from "@playwright/test"
import { loginWithTestUser, signupAndLogin } from "./utils"

const toggleSidebarText = "Toggle Sidebar"
const newChatText = "New Chat"
const searchText = "Search"
const settingsText = "Settings"

test("user can see and toggle sidebar", async ({ page }) => {
    await signupAndLogin(page)

    const toggleSidebar = page.getByTestId("toggle-sidebar")
    const newChat = page.getByTestId("new-chat")
    const search = page.getByTestId("search")
    const settings = page.getByTestId("settings")

    await expect(toggleSidebar).toBeVisible()
    await expect(newChat).toBeVisible()
    await expect(search).toBeVisible()
    await expect(settings).toBeVisible()

    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(search).toContainText(searchText)
    await expect(settings).toContainText(settingsText)

    await toggleSidebar.click()
    await expect(toggleSidebar).not.toContainText(toggleSidebarText)
    await expect(newChat).not.toContainText(newChatText)
    await expect(search).not.toContainText(searchText)
    await expect(settings).not.toContainText(settingsText)

    await toggleSidebar.click()
    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(search).toContainText(searchText)
    await expect(settings).toContainText(settingsText)
})

test("user can see and toggle sidebar with chats", async ({ page }) => {
    const user = await loginWithTestUser(page)

    const toggleSidebar = page.getByTestId("toggle-sidebar")
    const newChat = page.getByTestId("new-chat")
    const search = page.getByTestId("search")
    const settings = page.getByTestId("settings")

    await expect(toggleSidebar).toBeVisible()
    await expect(newChat).toBeVisible()
    await expect(search).toBeVisible()
    await expect(settings).toBeVisible()

    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(search).toContainText(searchText)
    await expect(settings).toContainText(settingsText)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title })).toBeVisible()
    }

    await toggleSidebar.click()
    await expect(toggleSidebar).not.toContainText(toggleSidebarText)
    await expect(newChat).not.toContainText(newChatText)
    await expect(search).not.toContainText(searchText)
    await expect(settings).not.toContainText(settingsText)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title })).not.toBeVisible()
    }

    await toggleSidebar.click()
    await expect(toggleSidebar).toContainText(toggleSidebarText)
    await expect(newChat).toContainText(newChatText)
    await expect(search).toContainText(searchText)
    await expect(settings).toContainText(settingsText)
    for (const chat of user.chats) {
        await expect(page.getByRole("link", { name: chat.title })).toBeVisible()
    }
})