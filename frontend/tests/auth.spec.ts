import { expect, test } from "@playwright/test"
import { getRandomEmail, signup } from "./utils"

test("user can sign up", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", "testpassword")

    await page.click("button")
    await page.waitForURL("/")
})

test("user cannot sign up with existing email", async ({ page }) => {
    const [email, password] = await signup()

    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await expect(page.getByText("Email is already registered. Please choose another one.", { exact: true })).toBeVisible()
})

test("user can login", async ({ page }) => {
    const [email, password] = await signup()

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")
})

test("user cannot login with invalid email", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", "invalid@example.com")
    await page.fill("input[type='password']", "testpassword")

    await page.click("button")
    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user cannot login with invalid password", async ({ page }) => {
    const [email] = await signup()

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", "invalidpassword")

    await page.click("button")
    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})