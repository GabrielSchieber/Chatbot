import { test } from "@playwright/test"

test("user can sign up", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", "test@example.com")
    await page.fill("input[type='password']", "testpassword")

    await page.click("button")
    await page.waitForURL("/")
})