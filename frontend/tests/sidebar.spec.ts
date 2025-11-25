import { expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

const toggleSidebarText = "Close Sidebar"
const newChatText = "New Chat"
const searchChatsText = "Search Chats"
const openSettingsText = "Settings"

test("user can see and toggle sidebar", async ({ page }) => {
    await signupAndLogin(page)

    const isWidthSmall = page.viewportSize()!.width < 750

    const toggleSidebar = page.getByRole("button", { name: toggleSidebarText })
    const newChat = page.getByRole("link", { name: newChatText })
    const searchChats = page.getByRole("button", { name: searchChatsText })
    const openSettings = page.getByRole("button", { name: openSettingsText })
    const historyParagraph = page.getByRole("paragraph").getByText("You don't have any chats.", { exact: true })

    const header = page.getByRole("banner")
    await expect(header).toHaveCount(1)

    await expect(header.getByRole("button")).toHaveCount(isWidthSmall ? 2 : 0)
    await expect(header.getByRole("link")).toHaveCount(isWidthSmall ? 1 : 0)

    const headerToggleSidebar = header.getByRole("button").first()
    const headerNewChat = header.getByRole("link")
    const headerSearchChats = header.getByRole("button").last()

    function successfulMeResponse() {
        return page.waitForResponse(response =>
            response.url().endsWith("/api/me/") && response.status() === 200 && response.request().method() === "PATCH"
        )
    }

    if (isWidthSmall) {
        await expect(toggleSidebar).not.toBeVisible()
        await expect(newChat).not.toBeVisible()
        await expect(searchChats).not.toBeVisible()
        await expect(openSettings).not.toBeVisible()

        await expect(headerToggleSidebar).toBeVisible()
        await expect(headerNewChat).toBeVisible()
        await expect(headerSearchChats).toBeVisible()

        const response1 = successfulMeResponse()
        await headerToggleSidebar.click()
        await response1

        await expect(toggleSidebar).toBeVisible()
        await expect(newChat).toBeVisible()
        await expect(searchChats).toBeVisible()
        await expect(openSettings).toBeVisible()
        await expect(historyParagraph).toBeVisible()

        const response2 = successfulMeResponse()
        await toggleSidebar.click()
        await response2

        await expect(toggleSidebar).not.toBeVisible()
        await expect(newChat).not.toBeVisible()
        await expect(searchChats).not.toBeVisible()
        await expect(openSettings).not.toBeVisible()

        await expect(headerToggleSidebar).toBeVisible()
        await expect(headerNewChat).toBeVisible()
        await expect(headerSearchChats).toBeVisible()
    } else {
        await expect(toggleSidebar).toBeVisible()
        await expect(newChat).toBeVisible()
        await expect(searchChats).toBeVisible()
        await expect(openSettings).toBeVisible()
        await expect(historyParagraph).toBeVisible()

        const response1 = successfulMeResponse()
        await toggleSidebar.click()
        await response1

        await expect(toggleSidebar).not.toBeVisible()
        await expect(newChat).not.toBeVisible()
        await expect(searchChats).not.toBeVisible()
        await expect(openSettings).not.toBeVisible()
        await expect(historyParagraph).not.toBeVisible()

        await expect(headerToggleSidebar).not.toBeVisible()
        await expect(headerNewChat).not.toBeVisible()
        await expect(headerSearchChats).not.toBeVisible()

        const response2 = successfulMeResponse()
        await page.getByRole("button").first().click()
        await response2

        await expect(toggleSidebar).toBeVisible()
        await expect(newChat).toBeVisible()
        await expect(searchChats).toBeVisible()
        await expect(openSettings).toBeVisible()
        await expect(historyParagraph).toBeVisible()
    }
})

test("user can see and toggle sidebar with chats", async ({ page }, testInfo) => {
    const user = await signupAndLogin(page, true)

    const isWidthSmall = page.viewportSize()!.width < 750

    const toggleSidebar = page.getByRole("button", { name: toggleSidebarText })
    const newChat = page.getByRole("link", { name: newChatText })
    const searchChats = page.getByRole("button", { name: searchChatsText })
    const openSettings = page.getByRole("button", { name: openSettingsText })

    const historyParagraph = page.getByRole("paragraph").getByText("You don't have any chats.", { exact: true })
    const visibleChatEntries = page.getByTestId("history").getByRole("link").filter({ visible: true })
    const visibleToggleChatOptions = page.getByLabel("Toggle chat options", { exact: true }).filter({ visible: true })

    const header = page.getByRole("banner")
    await expect(header).toHaveCount(1)

    await expect(header.getByRole("button")).toHaveCount(isWidthSmall ? 2 : 0)
    await expect(header.getByRole("link")).toHaveCount(isWidthSmall ? 1 : 0)

    const headerToggleSidebar = header.getByRole("button").first()
    const headerNewChat = header.getByRole("link")
    const headerSearchChats = header.getByRole("button").last()

    function successfulMeResponse() {
        return page.waitForResponse(response =>
            response.url().endsWith("/api/me/") && response.status() === 200 && response.request().method() === "PATCH"
        )
    }

    if (isWidthSmall) {
        await expect(toggleSidebar).not.toBeVisible()
        await expect(newChat).not.toBeVisible()
        await expect(searchChats).not.toBeVisible()
        await expect(openSettings).not.toBeVisible()

        await expect(historyParagraph).not.toBeVisible()
        await expect(visibleChatEntries).toHaveCount(0)
        await expect(visibleToggleChatOptions).toHaveCount(0)

        await expect(headerToggleSidebar).toBeVisible()
        await expect(headerNewChat).toBeVisible()
        await expect(headerSearchChats).toBeVisible()

        const response1 = successfulMeResponse()
        await headerToggleSidebar.click()
        await response1

        await expect(toggleSidebar).toBeVisible()
        await expect(newChat).toBeVisible()
        await expect(searchChats).toBeVisible()
        await expect(openSettings).toBeVisible()

        await expect(historyParagraph).not.toBeVisible()
        await expect(visibleChatEntries).toHaveCount(user.chats.length)
        await expect(visibleToggleChatOptions).toHaveCount(testInfo.project.use.isMobile! ? user.chats.length : 0)

        const response2 = successfulMeResponse()
        await toggleSidebar.click()
        await response2

        await expect(toggleSidebar).not.toBeVisible()
        await expect(newChat).not.toBeVisible()
        await expect(searchChats).not.toBeVisible()
        await expect(openSettings).not.toBeVisible()

        await expect(historyParagraph).not.toBeVisible()
        await expect(visibleChatEntries).toHaveCount(0)
        await expect(visibleToggleChatOptions).toHaveCount(0)

        await expect(headerToggleSidebar).toBeVisible()
        await expect(headerNewChat).toBeVisible()
        await expect(headerSearchChats).toBeVisible()
    } else {
        await expect(toggleSidebar).toBeVisible()
        await expect(newChat).toBeVisible()
        await expect(searchChats).toBeVisible()
        await expect(openSettings).toBeVisible()

        await expect(historyParagraph).not.toBeVisible()
        await expect(visibleChatEntries).toHaveCount(user.chats.length)
        await expect(visibleToggleChatOptions).toHaveCount(testInfo.project.use.isMobile! ? user.chats.length : 0)

        const response1 = successfulMeResponse()
        await toggleSidebar.click()
        await response1

        await expect(toggleSidebar).not.toBeVisible()
        await expect(newChat).not.toBeVisible()
        await expect(searchChats).not.toBeVisible()
        await expect(openSettings).not.toBeVisible()

        await expect(historyParagraph).not.toBeVisible()
        await expect(visibleChatEntries).toHaveCount(0)
        await expect(visibleToggleChatOptions).toHaveCount(0)

        await expect(headerToggleSidebar).not.toBeVisible()
        await expect(headerNewChat).not.toBeVisible()
        await expect(headerSearchChats).not.toBeVisible()

        const response2 = successfulMeResponse()
        await page.getByRole("button").first().click()
        await response2

        await expect(toggleSidebar).toBeVisible()
        await expect(newChat).toBeVisible()
        await expect(searchChats).toBeVisible()
        await expect(openSettings).toBeVisible()

        await expect(historyParagraph).not.toBeVisible()
        await expect(visibleChatEntries).toHaveCount(user.chats.length)
        await expect(visibleToggleChatOptions).toHaveCount(testInfo.project.use.isMobile! ? user.chats.length : 0)
    }
})

test("user can rename chats", async ({ page }, testInfo) => {
    const user = await signupAndLogin(page, true)

    const chat = user.chats[0]
    const link = page.getByRole("link").nth(1)
    await expect(link).toContainText(chat.title)
    await expect(link.getByRole("button", { includeHidden: true })).toHaveCount(1)

    if (!testInfo.project.use.isMobile!) {
        await link.hover()
    }
    await link.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click()

    const renameInput = page.locator("input[type='text']")
    await expect(renameInput).toBeVisible()
    await renameInput.fill("Renamed Chat")
    await renameInput.press("Enter")
    await expect(renameInput).not.toBeVisible()

    const renamedChatLink = page.locator("a").getByText("Renamed Chat", { exact: true })
    await expect(renamedChatLink).toBeVisible()

    await page.reload()

    await expect(renamedChatLink).toBeVisible()
})

test("user can archive chats", async ({ page }, testInfo) => {
    const user = await signupAndLogin(page, true)

    const chat = user.chats[0]
    const link = page.getByRole("link", { name: chat.title })
    await expect(link.getByRole("button", { includeHidden: true })).toHaveCount(1)

    if (!testInfo.project.use.isMobile!) {
        await link.hover()
    }
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