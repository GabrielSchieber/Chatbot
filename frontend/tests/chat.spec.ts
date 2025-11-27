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

    const message = "Describe the following file in a concise way."
    const fileName = "about-cats.txt"
    const fileContent = "The purpose of this file is to describe cats and their behavior."
    const expectedResponse = "This file contains information about the purpose, content, and how it should be used for the file on which you are interested in learning more about the cat."

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

    const message = "Describe the files."
    const file1Name = "about-cats.txt"
    const file1Content = "The purpose of this file is to describe cats and their behavior."
    const file2Name = "about-dogs.txt"
    const file2Content = "The purpose of this file is to describe dogs and their behavior."
    const expectedResponse = "Cats are the perfect companions for many, as they provide a unique mix of independence and loyalty that makes them an ideal companion for those who love to play fetch or even just sit in front of the computer without looking at the cat's picture too much."

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

    const message = "Hello!"
    const fileName = "about-cats.txt"
    const fileContent = "The purpose of this file is to describe cats and their behavior."
    const expectedResponse = "How can I help you today?"

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

test("user can remove one attached file from many existing ones before sending message", async ({ page }) => {
    await signupAndLogin(page)

    const message = "Describe the files briefly."
    const file1Name = "about-cats.txt"
    const file1Content = "The purpose of this file is to describe cats and their behavior."
    const file2Name = "about-dogs.txt"
    const file2Content = "The purpose of this file is to describe dogs and their behavior."
    const file3Name = "about-birds.txt"
    const file3Content = "The purpose of this file is to describe birds and their behavior."
    const expectedResponse = "Cats are about-about-pets.txt, about-about-about-paws.txt. They like to play with the paws and they want to be a part of your family."

    for (const [fileName, fileContent] of [[file1Name, file1Content], [file2Name, file2Content], [file3Name, file3Content]]) {
        await page.setInputFiles("input[type='file']", {
            name: fileName,
            mimeType: "text/plain",
            buffer: (globalThis as any).Buffer.from(fileContent)
        })
        await expect(page.getByText(fileName)).toBeVisible()
    }

    await expect(page.getByText(file2Name)).toBeVisible()
    await page.getByTestId("remove-attachment-button-about-dogs.txt").click()
    await expect(page.getByText(file2Name)).not.toBeVisible()

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
    const secondBotMessage = "What do I need to do?"

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(firstBotMessage, { timeout })

    await page.getByTestId("edit").click()
    const userMessageTextArea = page.getByText(firstUserMessage, { exact: true })
    await userMessageTextArea.click()
    await userMessageTextArea.press("ArrowLeft")
    await userMessageTextArea.fill(secondUserMessage)
    await page.getByTestId("send").first().click()

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    await expect(page.getByTestId("message-0")).toHaveText(secondUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(secondBotMessage, { timeout })

    await expect(stopButton).not.toBeVisible()
})

test("user can edit their message and attach a file", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const firstUserMessage = exampleChats[0].messages[0]
    const firstBotMessage = exampleChats[0].messages[1]

    const secondUserMessage = "Describe the following file in a concise way."
    const fileName = "about-cats.txt"
    const fileContent = "The purpose of this file is to describe cats and their behavior."
    const secondBotMessage = "(1)\nHere's what you are about to read: (2)\n\n\n\nThe purpose of this text is to provide information about the world of cats, including how they behave in different situations."

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(firstBotMessage, { timeout })

    await page.getByTestId("edit").click()
    const userMessageTextArea = page.getByText(firstUserMessage, { exact: true })
    await userMessageTextArea.click()
    await userMessageTextArea.press("ArrowLeft")
    await userMessageTextArea.fill(secondUserMessage)

    await page.setInputFiles("input[type='file']", {
        name: fileName,
        mimeType: "text/plain",
        buffer: (globalThis as any).Buffer.from(fileContent)
    })
    await expect(page.getByText(fileName)).toBeVisible()

    await page.getByTestId("send").first().click()

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    await expect(page.getByTestId("message-0")).toHaveText(secondUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(secondBotMessage, { timeout })

    await expect(stopButton).not.toBeVisible()
})

test("user can edit their message and remove a file", async ({ page }) => {
    await signupAndLogin(page)

    const userMessage1 = "Describe the following file in a concise way."
    const fileName = "about-cats.txt"
    const fileContent = "The purpose of this file is to describe cats and their behavior."
    const botMessage1 = "This file contains information about the purpose, content, and how it should be used for the file on which you are interested in learning more about the cat."

    const userMessage2 = "Hello!"
    const botMessage2 = "Is that all you have to say?"

    await page.setInputFiles("input[type='file']", {
        name: fileName,
        mimeType: "text/plain",
        buffer: (globalThis as any).Buffer.from(fileContent)
    })

    await expect(page.getByText(fileName)).toBeVisible()

    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(userMessage1)
    await textarea.press("Enter", { delay: 20, timeout: 1000 })
    await expect(textarea).not.toContainText(userMessage1)

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    const userMessage = page.getByTestId("message-0")
    const botMessage = page.getByTestId("message-1")

    await expect(userMessage).toBeVisible({ timeout })
    await expect(botMessage).toBeVisible({ timeout })

    await expect(userMessage).toContainText(userMessage1, { timeout })
    await expect(botMessage).toContainText(botMessage1, { timeout })

    await expect(stopButton).not.toBeVisible({ timeout })

    await page.getByTestId("edit").click()

    await expect(page.getByText(fileName)).toBeVisible()
    await page.getByTestId("remove-attachment-button-about-cats.txt").click()
    await expect(page.getByText(fileName)).not.toBeVisible()

    const userMessageTextArea = page.getByText(userMessage1, { exact: true })
    await userMessageTextArea.click()
    await userMessageTextArea.press("ArrowLeft")
    await userMessageTextArea.fill(userMessage2)

    await page.getByTestId("send").first().click()

    await expect(stopButton).toBeVisible()

    await expect(userMessage).toHaveText(userMessage2, { timeout })
    await expect(botMessage).toHaveText(botMessage2, { timeout })

    await expect(stopButton).not.toBeVisible()
})

test("user can regenerate messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendExampleChat(page, 0)

    const firstUserMessage = exampleChats[0].messages[0]
    const firstBotMessage = exampleChats[0].messages[1]
    const secondBotMessage = "Dear Sir/MRS.S, please inform me about your visit? We appreciate your consideration. Thank you for visiting us today!\n\n\nI'm glad of your request. I'd be happy to assist in any way that suits your needs and preferences. Please come later if you're interested?"

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(firstBotMessage, { timeout })

    await page.getByTestId("regenerate").click()

    const regenerateDropdown = page.getByTestId("regenerate-dropdown")
    await expect(regenerateDropdown).toBeVisible()

    const regenerateDropdownEntries = regenerateDropdown.getByTestId("regenerate-dropdown-entry")
    await expect(regenerateDropdownEntries).toHaveCount(4)

    await regenerateDropdownEntries.first().click()

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    await expect(page.getByTestId("message-0")).toHaveText(firstUserMessage, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(secondBotMessage, { timeout })

    await expect(stopButton).not.toBeVisible()
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
        title: "What is the issue or problem we need to solve",
        messages: [
            "Hello!",
            "How can I help you today?"
        ]
    },
    {
        title: "What are the steps to follow through on this conversation",
        messages: [
            "I have eggs and spinach. What can I make?",
            "You can try making an omelet or a salad with some of those same ingredients, such as eggs and spinach."
        ]
    }
]