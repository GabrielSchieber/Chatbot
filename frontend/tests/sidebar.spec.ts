import { expect, Page } from "@playwright/test"
import { test, User } from "./utils"

test("user can toggle sidebar", async ({ page, users }) => {
    const toggleSidebarText = "Toggle Sidebar"
    const newChatText = "New Chat"
    const searchText = "Search"
    const settingsText = "Settings"

    await login(page, users[0])

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

test("user can open search", async ({ page, users }) => {
    const user = users[1]
    const chat = user.chats[0]
    const messages = chat.messages

    await login(page, user)

    await page.getByTestId("search").click()

    await expect(page.getByPlaceholder("Search chats...")).toBeVisible()

    const searchEntry = page.getByRole("link", { "name": chat.title })
    await expect(searchEntry).toBeVisible()

    const matches = searchEntry.getByRole("list")
    await expect(matches.getByRole("listitem").first()).toHaveText(messages[0].text + "...")
    await expect(matches.getByRole("listitem").last()).toHaveText(messages[1].text + "...")

    await expect(page.getByRole("button")).toBeVisible()
})

test("user can search chats", async ({ page, users }) => {
    const user = users[1]
    const chat = user.chats[0]
    const messages = chat.messages

    await login(page, user)
    await expect(page.getByText("No more chats")).toBeVisible()

    const searchButton = page.getByTestId("search")
    await expect(searchButton).toBeVisible()
    await searchButton.click()

    const searchEntry = page.getByRole("link", { "name": chat.title })
    await expect(searchEntry).toBeVisible()

    const searchInput = page.getByPlaceholder("Search chats...")
    await expect(searchInput).toBeVisible()
    await expect(page.getByText(messages[0].text)).toBeVisible()
    await expect(page.getByText(messages[1].text)).toBeVisible()

    await searchInput.fill("Some chat")
    await expect(searchEntry).not.toBeVisible()
    await expect(page.getByText(messages[0].text)).not.toBeVisible()
    await expect(page.getByText(messages[1].text)).not.toBeVisible()

    await searchInput.fill("Greetings")
    await expect(searchEntry).toBeVisible()
    await expect(page.getByText(messages[0].text)).not.toBeVisible()
    await expect(page.getByText(messages[1].text)).not.toBeVisible()

    await searchInput.fill("How are")
    await expect(searchEntry).toBeVisible()
    await expect(page.getByText(messages[0].text)).not.toBeVisible()
    await expect(page.getByText(messages[1].text)).toBeVisible()
})

test("user without chats doesn't see any chats in search panel", async ({ page, users }) => {
    const user = users[0]

    await login(page, user)
    await expect(page.getByText("No more chats")).toBeVisible()

    const searchButton = page.getByTestId("search")
    await expect(searchButton).toBeVisible()
    await searchButton.click()

    const searchEntry = page.getByRole("link")
    await expect(searchEntry).not.toBeVisible()

    const matches = searchEntry.getByRole("list")
    await expect(matches.getByRole("listitem")).toHaveCount(0)

    await expect(page.getByText("No chats found.")).toBeVisible()
})

async function login(page: Page, user: User) {
    await page.goto("/")
    await page.waitForURL("/login")
    await page.getByPlaceholder("Email").fill(user.email)
    await page.getByPlaceholder("Password").fill(user.password)
    await page.getByRole("button").click()
    await page.waitForURL("/")
}