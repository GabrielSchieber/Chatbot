import { expect, test as base } from "@playwright/test"
import { execSync } from "child_process"

type Message = {
    text: string
    is_from_user: boolean
}

type Chat = {
    title: string
    uuid: string
    messages: Message[]
}

type User = {
    email: string
    password: string
    chats: Chat[]
}

type TestFixtures = { user: User }

const test = base.extend<TestFixtures>({
    user: [
        async ({ }, use) => {
            const email = "test@example.com"
            const password = "testpassword"

            const chats: Chat[] = [
                {
                    title: "Greetings!",
                    uuid: "",
                    messages: [
                        {
                            text: "Hi!",
                            is_from_user: true
                        },
                        {
                            text: "Hello! How are you going?",
                            is_from_user: false
                        }
                    ]
                }
            ]

            function executeBackendCommand(args: string[]): string {
                return execSync(`cd /app/backend && python manage.py ${args.join(" ")}`).toString().trim()
            }

            executeBackendCommand(["create_user", "--email", email, "--password", password])
            for (const chat of chats) {
                chat.uuid = executeBackendCommand(["create_chat", "--user-email", email, "--chat-title", chat.title])
                for (const message of chat.messages) {
                    executeBackendCommand([
                        "create_message", "--user-email", email, "--chat-uuid", chat.uuid,
                        "--message-text", `"${message.text}"`, "--message-is-from-user", message.is_from_user ? "True" : "False"
                    ])
                }
            }

            await use({ email, password, chats })
        },
        { scope: "worker", auto: true }
    ]
})

test.beforeEach(async ({ page, user }) => {
    await page.goto("/")
    await page.waitForURL("/login")
    await page.getByPlaceholder("Email").fill(user.email)
    await page.getByPlaceholder("Password").fill(user.password)
    await page.getByRole("button").click()
    await page.waitForURL("/")
})

test("user can toggle sidebar", async ({ page }) => {
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

test("user can open search", async ({ page, user }) => {
    await page.getByTestId("search").click()

    const searchInput = page.getByPlaceholder("Search chats...")
    await expect(searchInput).toBeVisible()

    const searchEntry = page.getByRole("link", { "name": "Greetings!" })
    await expect(searchEntry).toBeVisible()

    const closeButton = page.getByRole("button")
    await expect(closeButton).toBeVisible()

    await expect(page.getByText(user.chats[0].messages[0].text + "...")).toBeVisible()
    await expect(page.getByText(user.chats[0].messages[1].text + "...")).toBeVisible()
})