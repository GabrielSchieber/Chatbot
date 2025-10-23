import { Locator, expect, test } from "@playwright/test"
import { Chat, signupAndLogin } from "./utils"

test("user can open search", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    await page.getByRole("button", { name: "Search Chats", exact: true }).click()

    await expect(page.getByPlaceholder("Search chats...", { exact: true })).toBeVisible()

    const entries = page.getByRole("link")

    const entriesAndChats: [Locator, Chat][] = (await entries.all()).map((e, i) => [e, user.chats[i]])

    for (const [entry, chat] of entriesAndChats) {
        await expect(entry).toContainText(chat.title)
        expect(await entry.getAttribute("href")).toEqual(`/chat/${chat.uuid}`)

        for (const message of chat.messages) {
            await expect(entry).toContainText(message.text.slice(0, 100) + "...")
        }
    }
})

test("user can search chats", async ({ page }) => {
    const user = await signupAndLogin(page, true)

    function findChatByTitle(title: string) {
        return user.chats.find(c => c.title === title)
    }

    type Entry = { chat: Chat, matches: [number, string][] }

    async function search(search: string, entries: Entry[]) {
        async function type(text: string) {
            await input.click()
            await input.fill(text)
            await input.press("Enter")
        }

        await input.fill("")
        const entryLinks = page.getByRole("link")

        await type(search)
        await expect(entryLinks).toHaveCount(entries.length)

        for (const [entry, i] of entries.map<[Entry, number]>((e, i) => [e, i])) {
            const entryLink = entryLinks.nth(i)
            expect(await entryLink.getAttribute("href")).toEqual(`/chat/${entry.chat.uuid}`)

            const entryContent = entryLink.locator("div")
            await expect(entryContent).toBeVisible()
            await expect(entryContent).toContainText("")
            await expect(entryContent.locator("p")).toHaveText(entry.chat.title)

            const matches = entryContent.locator("ul")
            for (const [i, text] of entry.matches) {
                await expect(matches.nth(i)).toContainText(text)
            }
        }
    }

    const mathParagraphChat = findChatByTitle("Paragraph About Math")!
    const mathHelpChat = findChatByTitle("Math Help")!
    const bookChat = findChatByTitle("Book Recommendation")!
    const petAdviceChat = findChatByTitle("Pet Advice")!
    const travelAdviceChat = findChatByTitle("Travel Advice")!
    const jobInterviewChat = findChatByTitle("Job Interview Prep")!
    const techSupportChat = findChatByTitle("Tech Support")!
    const motivationChat = findChatByTitle("Motivation")!
    const weatherInquiryChat = findChatByTitle("Weather Inquiry")!

    await page.getByRole("button", { name: "Search Chats", exact: true }).click()
    const input = page.getByPlaceholder("Search chats...", { exact: true })
    await expect(input).toBeVisible()

    await search(
        "math",
        [
            {
                chat: mathParagraphChat,
                matches:
                    [
                        [0, mathParagraphChat.messages[0].text.slice(0, 100) + "..."],
                        [0, mathParagraphChat.messages[1].text.slice(0, 100) + "..."]
                    ]
            },
            {

                chat: mathHelpChat,
                matches: []
            }
        ]
    )

    await search(
        "book",
        [
            {
                chat: bookChat,
                matches: [[0, bookChat.messages[0].text.slice(0, 100) + "..."]]
            }
        ]
    )

    await search(
        "advice",
        [
            {
                chat: petAdviceChat,
                matches: [[0, petAdviceChat.messages[0].text.slice(0, 100) + "..."]]
            },
            {
                chat: travelAdviceChat,
                matches: []
            }
        ]
    )

    await search(
        "tech",
        [
            {
                chat: jobInterviewChat,
                matches: [[0, jobInterviewChat.messages[2].text.slice(0, 100) + "..."]]
            },
            {
                chat: techSupportChat,
                matches: []
            }
        ]
    )

    await search(
        "today",
        [
            {
                chat: motivationChat,
                matches: [[0, motivationChat.messages[1].text.slice(0, 100) + "..."]]
            },
            {
                chat: weatherInquiryChat,
                matches: [[0, weatherInquiryChat.messages[0].text.slice(0, 100) + "..."]]
            }
        ]
    )
})

test("search filters by title", async ({ page }) => {
    const user = await signupAndLogin(page, true)
    const chat = user.chats[0]

    await page.getByRole("button", { name: "Search Chats", exact: true }).click()

    const input = page.getByPlaceholder("Search chats...", { exact: true })
    await input.click()
    await input.fill(chat.title)
    await input.press("Enter")

    const entry = page.getByRole("link")
    await expect(entry).toContainText(chat.title)
    expect(await entry.getAttribute("href")).toEqual(`/chat/${chat.uuid}`)
})

test("search shows no results message when nothing matches", async ({ page }) => {
    await signupAndLogin(page, true)

    await page.getByRole("button", { name: "Search Chats", exact: true }).click()

    const input = page.getByPlaceholder("Search chats...", { exact: true })
    await input.click()
    await input.fill(`no-results-${Math.random().toString(36).slice(2)}`)
    await input.press("Enter")

    await expect(page.getByText("No chats found.", { exact: true })).toBeVisible({ timeout: 5000 })
})

test("infinite scroll loads more search entries", async ({ page }) => {
    await signupAndLogin(page, true)

    await page.getByRole("button", { name: "Search Chats", exact: true }).click()
    const dialog = page.getByRole("dialog")

    const entries = dialog.getByRole("link")
    const initialCount = await entries.count()

    const container = dialog.locator('div.overflow-y-auto')
    await container.evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight })

    await page.waitForFunction((initial) => {
        const dialogEl = document.querySelector('[role="dialog"]')
        if (!dialogEl) return false
        const links = dialogEl.querySelectorAll('a')
        return links.length > initial
    }, initialCount, { timeout: 5000 })

    const newCount = await entries.count()
    expect(newCount).toBeGreaterThanOrEqual(initialCount + 1)
})

test("clicking a search entry navigates to the chat", async ({ page }) => {
    const user = await signupAndLogin(page, true)
    const firstChat = user.chats[0]

    await page.getByRole("button", { name: "Search Chats", exact: true }).click()

    const first = page.getByRole("dialog").getByRole("link").nth(0)
    expect(await first.getAttribute("href")).toEqual(`/chat/${firstChat.uuid}`)
    await first.click()

    await page.waitForURL(`**/chat/${firstChat.uuid}`, { timeout: 5000 })
    expect(page.url()).toContain(`/chat/${firstChat.uuid}`)
})