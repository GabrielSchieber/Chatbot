import { expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

test("user can toggle sidebar", async ({ page }) => {
    await signupAndLogin(page)

    const toggleSidebarText = "Toggle Sidebar"
    const newChatText = "New Chat"
    const searchText = "Search"
    const settingsText = "Settings"

    const toggleSidebar = page.getByTestId("toggle-sidebar")
    const newChat = page.getByTestId("new-chat")
    const search = page.getByTestId("search")
    const settings = page.getByTestId("settings")

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