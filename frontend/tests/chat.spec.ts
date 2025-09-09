import { expect, Page, test } from "@playwright/test"
import { getRandomEmail } from "./utils"

const password = "testpassword"

async function signupAndLogin(page: Page) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")
}

async function sendMessage(page: Page, message: string, expectedResponse: string) {
    const textarea = page.getByRole("textbox", { name: "Ask me anything..." })
    await textarea.fill(message)
    await textarea.press("Enter")

    await expect(page.locator("#root")).toContainText(message)
    await expect(page.locator("#root")).toContainText(expectedResponse)
}

test("user can chat with bot", async ({ page }) => {
    await signupAndLogin(page)
    await sendMessage(page, "Hello!", "Hello! What's up? How can I help you today?")
    await expect(page.getByRole("link", { name: "Chat 1" })).toBeVisible()
})

test("user can chat with bot multiple times", async ({ page }) => {
    await signupAndLogin(page)
    await sendMessage(
        page,
        "What is Mathematics? Describe it in one phrase.",
        "Mathematics - A vibrant and ever-evolving field of study that delves into the intricacies of numbers, shapes, patterns, and relationships, using logical reasoning to describe and understand the world around us."
    )
    await sendMessage(
        page,
        "What is Geometry? Describe it in one phrase.",
        "Geometry is a fundamental branch of mathematics that deals with the study of shape, size, position, orientation, and spatial relationships, often visualized through geometric figures such as triangles, squares, circles, and polygons. It provides insight into the properties of space and shapes, including their sizes and positions in relation to one another."
    )
})