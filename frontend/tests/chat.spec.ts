import { Page, expect, test } from "@playwright/test"
import { signupAndLogin } from "./utils"

test.beforeEach(async ({ page }) => {
    test.setTimeout(timeout)

    await page.addInitScript(() => {
        const store = { text: "" }

        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (t: string) => { store.text = t },
                readText: async () => store.text
            },
            configurable: true
        })
    })
})

test("user can chat with bot", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)
    await sendExampleChat(page, 1)
})

test("user can chat with bot with a file", async ({ page }) => {
    await signupAndLogin(page)

    await page.goto("/")

    const message = "Describe the following file."
    const fileName = "about-cats.txt"
    const fileContent = "The purpose of this file is to describe cats and their behavior."
    const expectedResponse = `The file "about-cats.txt" describes a cat's behavior. The content lists the names of different cat breeds.`

    await page.setInputFiles("input[type='file']", {
        name: fileName,
        mimeType: "text/plain",
        buffer: (globalThis as any).Buffer.from(fileContent)
    })

    await expect(page.getByText(fileName)).toBeVisible()

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter", { delay: 20, timeout: 1000 })
    await expect(textarea).not.toContainText(message)

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    const userMessage = page.getByTestId("message-0")
    const botMessage = page.getByTestId("message-1")

    await expect(userMessage).toBeVisible({ timeout })
    await expect(botMessage).toBeVisible({ timeout })

    await expect(userMessage).toContainText(message, { timeout })
    await expect(botMessage).toContainText(expectedResponse, { timeout })

    await expect(stopButton).not.toBeVisible({ timeout })

    if (page.viewportSize()!.width < 750) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await expect(page.getByText("Close Sidebar")).toBeVisible()
    await expect(page.getByTestId("history").getByRole("link").first()).toBeVisible()
})

test("user can chat with bot with multiple files", async ({ page }) => {
    await signupAndLogin(page)

    const message = "Summarize the files."
    const file1Name = "about-cats.txt"
    const file1Content = "The purpose of this file is to describe cats and their behavior."
    const file2Name = "about-dogs.txt"
    const file2Content = "The purpose of this file is to describe dogs and their behavior."
    const expectedResponse = "The files in the following sections describe cats and their behaviors:\n== About-cats.txt\nContains information about cats, including their size and characteristics.\n== About-dogs.txt\nContains information about dogs, including their size and characteristics."

    for (const [fileName, fileContent] of [[file1Name, file1Content], [file2Name, file2Content]]) {
        await page.setInputFiles("input[type='file']", {
            name: fileName,
            mimeType: "text/plain",
            buffer: (globalThis as any).Buffer.from(fileContent)
        })
        await expect(page.getByText(fileName)).toBeVisible()
    }

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter", { delay: 20, timeout: 1000 })
    await expect(textarea).not.toContainText(message)

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    const userMessage = page.getByTestId("message-0")
    const botMessage = page.getByTestId("message-1")

    await expect(userMessage).toBeVisible({ timeout })
    await expect(botMessage).toBeVisible({ timeout })

    await expect(userMessage).toContainText(message, { timeout })
    await expect(botMessage).toContainText(expectedResponse, { timeout })

    await expect(stopButton).not.toBeVisible({ timeout })

    if (page.viewportSize()!.width < 750) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await expect(page.getByText("Close Sidebar")).toBeVisible()
    await expect(page.getByTestId("history").getByRole("link").first()).toBeVisible()
})

test("user can remove attached file before sending message", async ({ page }) => {
    await signupAndLogin(page)
    await page.goto("/")

    const message = "Hello!"
    const fileName = "about-cats.txt"
    const fileContent = "The purpose of this file is to describe cats and their behavior."
    const expectedResponse = "Hello! How can I assist you today?"

    await page.setInputFiles("input[type='file']", {
        name: fileName,
        mimeType: "text/plain",
        buffer: (globalThis as any).Buffer.from(fileContent)
    })

    await expect(page.getByText(fileName)).toBeVisible()
    await page.getByTestId("remove-attachment-button-about-cats.txt").click()
    await expect(page.getByText(fileName)).not.toBeVisible()

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill("Hello!")
    await textarea.press("Enter", { delay: 20, timeout: 1000 })
    await expect(textarea).not.toContainText("Hello!")

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    const userMessage = page.getByTestId("message-0")
    const botMessage = page.getByTestId("message-1")

    await expect(userMessage).toBeVisible({ timeout })
    await expect(botMessage).toBeVisible({ timeout })

    await expect(userMessage).toContainText(message, { timeout })
    await expect(botMessage).toContainText(expectedResponse, { timeout })

    await expect(stopButton).not.toBeVisible({ timeout })

    if (page.viewportSize()!.width < 750) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await expect(page.getByText("Close Sidebar")).toBeVisible()
    await expect(page.getByTestId("history").getByRole("link").first()).toBeVisible()
})

test("user can copy their own message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const copyButtons = page.getByTestId("copy")
    await expect(copyButtons).toHaveCount(2)
    await copyButtons.first().click()
    await expectClipboard(page, exampleChats[0].messages[0])
})

test("user can copy bot messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const copyButtons = page.getByTestId("copy")
    await expect(copyButtons).toHaveCount(2)
    await copyButtons.last().click()
    await expectClipboard(page, exampleChats[0].messages[1])
})

test("user can edit their message", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const firstUserMessage = exampleChats[0].messages[0]
    const firstBotMessage = exampleChats[0].messages[1]
    const secondUserMessage = "Howdy!"
    const secondBotMessage = "It’s so much easier than you can imagine! What’s on your mind? Let's get a cup of tea, warm yourself in a comfortable chair, and see what the day has in store for us."

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(firstBotMessage, { timeout })

    await page.getByTestId("edit").click()
    const userMessageTextArea = page.getByText(firstUserMessage, { exact: true })
    await userMessageTextArea.click()
    await userMessageTextArea.press("ArrowLeft")
    await userMessageTextArea.fill(secondUserMessage)
    await page.getByTestId("send").first().click()

    await expect(page.getByTestId("message-0")).toHaveText(secondUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(secondBotMessage, { timeout })
})

test("user can regenerate messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const firstUserMessage = exampleChats[0].messages[0]
    const firstBotMessage = exampleChats[0].messages[1]
    const secondBotMessage = ""

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(firstBotMessage, { timeout })

    await page.getByTestId("regenerate").click()

    const regenerateDropdown = page.getByTestId("regenerate-dropdown")
    await expect(regenerateDropdown).toBeVisible()

    const regenerateDropdownEntries = regenerateDropdown.getByTestId("regenerate-dropdown-entry")
    await expect(regenerateDropdownEntries).toHaveCount(4)

    await regenerateDropdownEntries.first().click()

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(secondBotMessage, { timeout })
})

test("user can delete chats", async ({ page }) => {
    await signupAndLogin(page)

    await sendExampleChat(page, 0)
    await sendExampleChat(page, 1)

    const historyEntries = page.getByTestId("history").locator("a")

    if (page.viewportSize()!.width < 750) {
        await expect(page.getByText("Close Sidebar")).not.toBeVisible()
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await expect(page.getByText("Close Sidebar")).toBeVisible()

    await expect(historyEntries).toHaveCount(2)
    for (const chat of exampleChats.slice(0, 2)) {
        await expect(historyEntries.getByText(chat.title, { exact: true })).toBeVisible()
    }
    await page.goto("/")

    await expect(page.getByText("Close Sidebar")).toBeVisible()

    await page.getByText("Settings").click()
    await page.getByRole("tab", { name: "Data" }).click()
    const deleteChats = page.getByRole("button", { name: "Delete all", exact: true })
    await expect(deleteChats).toBeVisible()

    await deleteChats.click()

    const confirmDialogTitle = page.getByRole("heading", { name: "Delete Chats", exact: true })
    await expect(confirmDialogTitle).toBeVisible()

    const confirmDialog = confirmDialogTitle.locator("..")
    await expect(confirmDialog).toBeVisible()

    await expect(confirmDialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible()
    await confirmDialog.getByRole("button", { name: "Delete all", exact: true }).click()
    await expect(confirmDialogTitle).not.toBeVisible()
    await expect(confirmDialog).not.toBeVisible()

    await expect(page.getByRole("heading", { name: "Data", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Settings" })).not.toBeVisible()
    await expect(deleteChats).toBeVisible()

    await page.getByTestId("close-settings").click()
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()

    await expect(historyEntries).toHaveCount(0)
    for (const chat of exampleChats.slice(0, 2)) {
        await expect(historyEntries.getByText(chat.title, { exact: true })).not.toBeVisible()
    }

    await expect(page.getByText("You don't have any chats.", { exact: true })).toBeVisible()
})

test("user can create new chat", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    await expect(page.getByTestId("message-0")).toBeVisible({ timeout })
    await expect(page.getByTestId("message-1")).toBeVisible({ timeout })

    expect(page.url()).toContain("/chat/")
    if (page.viewportSize()!.width < 750) {
        await page.getByRole("banner").getByRole("link").click()
    } else {
        await page.getByText("New Chat").click()
    }
    await page.waitForURL("/")

    await expect(page.getByTestId("message-0")).not.toBeVisible({ timeout })
    await expect(page.getByTestId("message-1")).not.toBeVisible({ timeout })

    await expect(page.locator("p").getByText("Chatbot", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "How can I help you today?", exact: true })).toBeVisible()
})

async function sendMessage(page: Page, index: number, message: string, expectedResponse: string) {
    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter", { delay: 20, timeout: 1000 })
    await expect(textarea).not.toContainText(message)

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    const userMessage = page.getByTestId(`message-${index}`)
    const botMessage = page.getByTestId(`message-${index + 1}`)

    await expect(userMessage).toBeVisible({ timeout })
    await expect(botMessage).toBeVisible({ timeout })

    await expect(userMessage).toContainText(message, { timeout })
    await expect(botMessage).toContainText(expectedResponse, { timeout })

    await expect(stopButton).not.toBeVisible({ timeout })

    await expect(userMessage).toContainText(message, { timeout })
    await expect(botMessage).toContainText(expectedResponse, { timeout })
}

async function sendExampleChat(page: Page, index: number) {
    await page.goto("/")

    await expect(page.locator("p").getByText("Chatbot", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "How can I help you today?", exact: true })).toBeVisible()

    const chat = exampleChats[index]
    const messages = chat.messages
    for (let i = 0; i < messages.length; i += 2) {
        await sendMessage(page, i, messages[i], messages[i + 1])
        if (i === 1) {
            await expect(page.getByTestId("history").getByRole("link").first().getByRole("paragraph", { name: chat.title, exact: true })).toBeVisible()
        }
    }
}

async function expectClipboard(page: Page, expected: string) {
    expect(await page.evaluate(_ => navigator.clipboard.readText())).toEqual(expected)
}

const timeout = 60_000

const exampleChats: { title: string, messages: string[] }[] = [
    {
        title: "I've got a lot of questions",
        messages: [
            "Hello!",
            "Hello! How can I assist you today?"
        ]
    },
    {
        title: "That's an excellent start. I",
        messages: [
            "What is Arithmetic? Describe it in one small phrase.",
            "Arithmetic, the process of counting and arranging numbers, is a cornerstone of mathematics. At its core, arithmetic involves assigning a number to every element in a set, allowing us to perform arithmetic operations on sets efficiently. Arithmetic is used in counting, problem-solving, and strategic planning across various fields, from counting objects",
            "And what is Algebra? Talk about it briefly.",
            "It is a foundational branch of mathematics that studies shapes and patterns within sets of objects, using a method called graph theory to describe relationships between them. Algebra combines abstract thinking with number theory and geometry to model real-world problems and abstract concepts in mathematics. It provides an algebraic perspective on shapes, allowing us to model and analyze"
        ]
    }
]