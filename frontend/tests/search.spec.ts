import test, { expect } from "@playwright/test"
import { createTestUser } from "./utils"

test("user can open search", async ({ page }) => {
    const user = await createTestUser(page)
    const chat = user.chats[0]
    const messages = chat.messages

    await page.getByRole("button", { name: "Search", exact: true }).click()

    await expect(page.getByPlaceholder("Search chats...", { exact: true })).toBeVisible()

    const entry = page.getByRole("link")
    await expect(entry).toHaveCount(1)
    expect(await entry.getAttribute("href")).toEqual(`/chat/${chat.uuid}`)

    await expect(entry.getByText(chat.title, { exact: true })).toHaveRole("paragraph")
    await expect(entry.getByText(messages[0].text + "...", { exact: true })).toHaveRole("listitem")
    await expect(entry.getByText(messages[1].text + "...", { exact: true })).toHaveRole("listitem")
})