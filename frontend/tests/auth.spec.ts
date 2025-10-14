import { expect, test } from "@playwright/test"
import { authenticator } from "otplib"
import { apiFetch, getRandomEmail, signupAndLogin } from "./utils"

test.describe.configure({ mode: "parallel" })

test("user can sign up", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")
})

test("user cannot sign up with existing email", async ({ page }) => {
    const email = await signup()

    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await expect(page.getByText("Email is already registered. Please choose another one.", { exact: true })).toBeVisible()
})

test("user can login", async ({ page }) => {
    const email = await signup()

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
    await page.fill("input[type='password']", password)

    await page.click("button")
    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user cannot login with invalid password", async ({ page }) => {
    const email = await signup()

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", "invalidpassword")

    await page.click("button")
    await expect(page.getByText("Email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user can enable multi-factor authentication", async ({ page }) => {
    await signupAndLogin(page)

    await page.getByTestId("open-settings").click()

    await page.getByText("Multi-factor authentication").locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Setup")).toBeVisible()

    await page.getByText("Generate QR and secret codes").click()
    await expect(page.getByText("Step 2: Verify")).toBeVisible()

    const secretText = await page.getByText(/Secret:/).textContent()
    const secret = secretText?.split("Secret:")[1].trim()!

    const code = authenticator.generate(secret)

    await page.getByPlaceholder("6-digit code").fill(code)
    await page.getByRole("button", { name: "Enable" }).click()

    await expect(page.getByText("Enabling")).toBeVisible()
    await expect(page.getByText("Step 3: Backup")).toBeVisible({ timeout: 15000 })

    await page.getByText("I have backed up the codes").click()
    await page.getByRole("button", { name: "Close" }).click()
})

const password = "testpassword"

async function signup() {
    const email = getRandomEmail()

    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    expect(response.status).toBe(201)

    return email
}