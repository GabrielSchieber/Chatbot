import { Page, expect, test } from "@playwright/test"
import { apiFetch, signupAndLogin } from "./utils"

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
    const expectedResponse = 'This file defines "about" for cats, explains how they behave (e.g., how quiet or aggressive), identifies different breeds by size and color, lists the colors of their coats, and includes some information about what kinds are allowed in certain areas of the home based on a code ("Code 120'

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
    const expectedResponse = `You've found a list of files that match the provided criteria, containing information on cats, including description fields.
pythonCopy# cat_list.pyx
def create_cat_object():
    cat1 = Cat("purriform")
    cat2 = Cat(squeeful)
    cat3`

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
    const expectedResponse = "Hello, welcome back from school! I hope you've been enjoying our discussions so far. Is there a particular topic or area where you'd like me to explain something interesting?"

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
    const expectedResponse = `Here's the information for each file:
languageCopy  File:  1089_about-cats.txt
Contents: 1 - About Cats
File:  3427_helpful@example.com.xml
Purpose of this file to provide assistance on cat care and`

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
    const secondUserMessage = "Hi!"
    const secondBotMessage = "That's me - I'm a great-for-me type of person too! You don't get it."

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
    const secondBotMessage = `File "about" describes what happens when they encounter you.


Please, tell me whether your website uses the following methods on a daily basis.


===== 1:   Use it for a day ===
Use it in a day === A lot of times, most days, but more often`

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
    const botMessage1 = 'This file defines "about" for cats, explains how they behave (e.g., how quiet or aggressive), identifies different breeds by size and color, lists the colors of their coats, and includes some information about what kinds are allowed in certain areas of the home based on a code ("Code 120'

    const userMessage2 = "Hello!"
    const botMessage2 = "Dear Sir/MRS.S, please inform me about your visit? We appreciate your consideration. Thank you for visiting us today!\n\n\nI'm glad of your request. I'd be happy to assist in any way that suits your needs and preferences. Please come later if you're interested?"

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

test("user can add and remove files while editing their message", async ({ page }) => {
    const user = await signupAndLogin(page)

    const userMessageText = "Describe the files."

    const userMessage1File1Name = "about-cats.txt"
    const userMessage1File1Content = "The purpose of this file is to describe cats and their behavior."
    const userMessage1File2Name = "about-dogs.txt"
    const userMessage1File2Content = "The purpose of this file is to describe dogs and their behavior."

    const userMessage2FileName = "about-birds.txt"
    const userMessage2FileContent = "The purpose of this file is to describe birds and their behavior."

    const botMessage1Text = "The files are about..."
    const botMessage2Text = `You're on a personal quest, I see! A couple's "about" files? That adds another dimension to our journey together. Let's dive into these files together!


Here's what each page means:
== About-dogs.txt === - Contains information about dogs for their behavior and breed`

    const messages = [
        {
            text: userMessageText,
            is_from_user: true,
            files: [
                {
                    name: userMessage1File1Name,
                    content: userMessage1File1Content,
                    content_type: "text/plain"
                },
                {
                    name: userMessage1File2Name,
                    content: userMessage1File2Content,
                    content_type: "text/plain"
                }
            ]
        },
        {
            text: botMessage1Text,
            is_from_user: false,
            files: []
        }
    ]

    const response = await apiFetch("/test/create-chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, title: "File Analysis", messages })
    })
    expect(response.status).toEqual(200)

    await page.reload()

    if (page.viewportSize()!.width < 750) {
        await expect(page.getByText("Close Sidebar")).not.toBeVisible()
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await expect(page.getByText("Close Sidebar")).toBeVisible()

    await page.getByText("File Analysis").click()

    if (page.viewportSize()!.width < 750) {
        await page.getByText("Close Sidebar").click()
    }
    await expect(page.getByText("Close Sidebar")).not.toBeVisible()

    const userMessage = page.getByTestId("message-0")
    const botMessage = page.getByTestId("message-1")

    await expect(userMessage).toHaveText(userMessageText)
    await expect(botMessage).toHaveText(botMessage1Text)

    async function checkFileVisibilityInMessage(name: string, visible: boolean) {
        const messageDiv = userMessage.locator("..").locator("div").first()
        await expect(messageDiv.getByText(`Name: ${name}`)).toBeVisible({ visible })
    }

    await checkFileVisibilityInMessage(userMessage1File1Name, true)
    await checkFileVisibilityInMessage(userMessage1File2Name, true)
    await checkFileVisibilityInMessage(userMessage2FileName, false)

    await page.getByTestId("edit").click()

    const editor = page.getByLabel("Edit message")

    async function checkFileVisibilityInEditor(name: string, visible: boolean) {
        await expect(editor.getByText(`Name: ${name}`)).toBeVisible({ visible })
    }

    await page.setInputFiles("input[type='file']", {
        name: userMessage2FileName,
        mimeType: "text/plain",
        buffer: (globalThis as any).Buffer.from(userMessage2FileContent)
    })

    await checkFileVisibilityInEditor(userMessage1File1Name, true)
    await checkFileVisibilityInEditor(userMessage1File2Name, true)
    await checkFileVisibilityInEditor(userMessage2FileName, true)

    await editor.getByTestId(`remove-attachment-button-${userMessage1File1Name}`).click()

    await checkFileVisibilityInEditor(userMessage1File1Name, false)
    await checkFileVisibilityInEditor(userMessage1File2Name, true)
    await checkFileVisibilityInEditor(userMessage2FileName, true)

    await expect(editor.getByRole("textbox")).toHaveText(userMessageText)
    await expect(botMessage).toHaveText(botMessage1Text)

    await editor.getByTestId("send").click()

    const stopButton = page.getByTestId("stop-button")
    await expect(stopButton).toBeVisible()

    await expect(userMessage).toHaveText(userMessageText)
    await expect(botMessage).toHaveText(botMessage2Text, { timeout })

    await expect(stopButton).not.toBeVisible()

    await page.reload()

    await expect(userMessage).toHaveText(userMessageText)
    await expect(botMessage).toHaveText(botMessage2Text)

    await checkFileVisibilityInMessage(userMessage1File1Name, false)
    await checkFileVisibilityInMessage(userMessage1File2Name, true)
    await checkFileVisibilityInMessage(userMessage2FileName, true)
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

test("user can change models between messages", async ({ page }) => {
    await signupAndLogin(page)
    await sendMessage(page, 0, "Hello!", "How can I help you today?")

    const dropdownTrigger = page.getByLabel("Add files and more")
    const modelSelection = page.getByTestId("model-selection")
    const modelSelectionEntries = modelSelection.getByTestId("model-selection-entry")

    await dropdownTrigger.click()
    await expect(modelSelectionEntries).toHaveCount(4)
    await modelSelectionEntries.nth(0).click()
    await page.keyboard.press("Escape")
    await expect(modelSelectionEntries).not.toBeVisible()

    await sendMessage(page, 2, "Hello again!", "Please make it into a sentence, please, what's your question?")
})

test("user can change models while editing a message", async ({ page }) => {
    await signupAndLogin(page)

    const userMessage1 = "Hello!"
    const userMessage2 = "Hello again!"
    const botMessage1 = "How can I help you today?"
    const botMessage2 = "Go on, Go on!"

    await sendMessage(page, 0, userMessage1, botMessage1)

    await page.getByTestId("edit").click()

    const dropdownTrigger = page.getByLabel("Add files and more").first()
    const modelSelection = page.getByTestId("model-selection").first()
    const modelSelectionEntries = modelSelection.getByTestId("model-selection-entry")

    await dropdownTrigger.click()
    await expect(modelSelectionEntries).toHaveCount(4)
    await modelSelectionEntries.nth(0).click()
    await page.keyboard.press("Escape")
    await expect(modelSelectionEntries).not.toBeVisible()

    const textArea = page.getByRole("textbox", { name: "Ask me anything..." }).first()
    await textArea.click()
    await textArea.press("ArrowLeft")
    await textArea.fill(userMessage2)
    await page.getByTestId("send").first().click()

    await expect(page.getByTestId("message-0")).toHaveText(userMessage2, { timeout })
    await expect(page.getByTestId("message-1")).toHaveText(botMessage2, { timeout })
})

test("user can set custom instructions", async ({ page }) => {
    await signupAndLogin(page)

    await sendMessage(page, 0, "Hello!", "Hello, welcome back from school! I hope you've been enjoying our discussions so far. Is there a particular topic or area where you'd like me to explain something interesting?")

    await page.goto("/")

    if (page.viewportSize()!.width < 750) {
        await expect(page.getByText("Close Sidebar")).not.toBeVisible()
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await expect(page.getByText("Close Sidebar")).toBeVisible()

    await page.getByText("Settings").click()
    await page.getByRole("tab", { name: "Customizations" }).click()

    await page.getByLabel("Custom instructions", { exact: true }).fill("Always talk like a pirate.")
    await page.getByRole("button", { name: "Save", exact: true }).click()

    await page.getByTestId("close-settings").click()

    if (page.viewportSize()!.width < 750) {
        await page.getByText("Close Sidebar").click()
    }

    await sendMessage(page, 0, "Hello!", `I'm here for you, and I'll do everything in my power to help. If you're lost or want to find me, please go ahead and say "I am the pirate."`)
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
        if (i <= 2) {
            const settingsButton = page.getByText("Settings")
            const isSettingsButtonVisible = await settingsButton.isVisible()
            if (!isSettingsButtonVisible) {
                await page.getByRole("banner").getByRole("button").first().click()
            }
            await expect(settingsButton).toBeVisible()

            await expect(page.getByTestId("history").getByRole("link").first().locator("p").getByText(chat.title, { exact: true })).toBeVisible()

            if (!isSettingsButtonVisible) {
                await page.getByRole("button", { name: "Close Sidebar" }).click()
                await expect(settingsButton).not.toBeVisible()
            }
        }
    }
}

async function expectClipboard(page: Page, expected: string) {
    expect(await page.evaluate(_ => navigator.clipboard.readText())).toEqual(expected)
}

const timeout = 60_000

const exampleChats: { title: string, messages: string[] }[] = [
    {
        title: "I'm excited to introduce you to the world of",
        messages: [
            "Hello!",
            "Hello, welcome back from school! I hope you've been enjoying our discussions so far. Is there a particular topic or area where you'd like me to explain something interesting?"
        ]
    },
    {
        title: "That concludes our interview with the weather!",
        messages: [
            "What's the weather like today?",
            "The weather is warm but sunny, with some clouds rolling in occasionally."
        ]
    }
]