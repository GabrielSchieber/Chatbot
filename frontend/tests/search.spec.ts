import { Locator, expect } from "@playwright/test"
import { Chat, test } from "./utils"

test("user can open search", async ({ page, user }) => {
    await page.getByRole("button", { name: "Search Chats", exact: true }).click()

    await expect(page.getByPlaceholder("Search chats...", { exact: true })).toBeVisible()

    const entries = page.getByRole("link")
    await expect(entries).toHaveCount(user.chats.length)

    const entriesAndChats: [Locator, Chat][] = (await entries.all()).map((e, i) => [e, user.chats[i]])

    for (const [entry, chat] of entriesAndChats) {
        await expect(entry).toContainText(chat.title)
        expect(await entry.getAttribute("href")).toEqual(`/chat/${chat.uuid}`)

        for (const message of chat.messages) {
            await expect(entry).toContainText(message.text.slice(0, 100) + "...")
        }
    }
})