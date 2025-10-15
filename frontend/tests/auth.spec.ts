import { Page, expect, test } from "@playwright/test"
import { authenticator } from "otplib"
import { apiFetch, getRandomEmail, signup, signupAndLogin } from "./utils"

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

    await page.getByPlaceholder("6-digit code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Enable" }).click()

    await expect(page.getByText("Enabling")).toBeVisible()
    await expect(page.getByText("Step 3: Backup")).toBeVisible({ timeout: 15000 })

    await page.getByText("I have backed up the codes").click()
    await page.getByRole("button", { name: "Close" }).click()
})

test("user can log in with multi-factor authentication", async ({ page }) => {
    const { user } = await signupWithMFAEnabled(page)

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")

    await expect(page.getByText("Verify multi-factor authentication", { exact: true })).toBeVisible()

    const response = await apiFetch(`/test/get-mfa-secret/?email=${user.email}`, {})
    expect(response.status).toBe(200)

    const secret = await response.json()
    const code = authenticator.generate(secret)

    await page.getByPlaceholder("Enter 6-digit code or recovery code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Verify" }).click()

    await page.waitForURL("/")
})

test("user can disable multi-factor authentication", async ({ page }) => {
    const { user } = await signupWithMFAEnabledAndLogin(page)

    await page.getByTestId("open-settings").click()

    await page.getByText("Multi-factor authentication").locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Disable")).toBeVisible()

    const response = await apiFetch(`/test/get-mfa-secret/?email=${user.email}`, {})
    expect(response.status).toBe(200)

    const secret = await response.json()
    const code = authenticator.generate(secret)

    await page.getByPlaceholder("Enter code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Disable" }).click()
    await expect(page.getByText("Step 2: Disabled")).toBeVisible()

    await page.getByRole("button", { name: "Close" }).click()
})

test("user can login with multi-factor authentication backup codes", async ({ page }) => {
    const { user, backupCodes } = await signupWithMFAEnabled(page)

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")

    await expect(page.getByText("Verify multi-factor authentication", { exact: true })).toBeVisible()

    await page.getByPlaceholder("Enter 6-digit code or recovery code", { exact: true }).fill(backupCodes[0])
    await page.getByRole("button", { name: "Verify" }).click()

    await page.waitForURL("/")
})

test("user cannot login with an already used multi-factor authentication backup code", async ({ page }) => {
    test.setTimeout(60_000)

    const { user, backupCodes } = await signupWithMFAEnabled(page)

    async function tryToLoginWithCode(code: string) {
        await page.goto("/")
        await page.waitForURL("/login")

        await page.fill("input[type='email']", user.email)
        await page.fill("input[type='password']", user.password)

        await page.click("button")

        await expect(page.getByText("Verify multi-factor authentication", { exact: true })).toBeVisible()

        await page.getByPlaceholder("Enter 6-digit code or recovery code", { exact: true }).fill(code)
        await page.getByRole("button", { name: "Verify" }).click()
        await expect(page.getByText("Verifying")).toBeVisible()
    }

    await tryToLoginWithCode(backupCodes[0])
    await page.waitForURL("/")

    await page.getByTestId("open-settings").click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("/login")

    await tryToLoginWithCode(backupCodes[0])
    await expect(page.getByText("Invalid code")).toBeVisible({ timeout: 15_000 })
})

test("user can disable multi-factor authentication with a backup code", async ({ page }) => {
    const { backupCodes } = await signupWithMFAEnabledAndLogin(page)

    await page.getByTestId("open-settings").click()

    await page.getByText("Multi-factor authentication").locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Disable")).toBeVisible()

    await page.getByPlaceholder("Enter code", { exact: true }).fill(backupCodes[0])
    await page.getByRole("button", { name: "Disable" }).click()
    await expect(page.getByText("Step 2: Disabled")).toBeVisible()

    await page.getByRole("button", { name: "Close" }).click()
})

async function signupWithMFAEnabledAndLogin(page: Page) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

    const user = await signupAndLogin(page)

    await page.getByTestId("open-settings").click()

    await page.getByText("Multi-factor authentication").locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Setup")).toBeVisible()

    await page.getByText("Generate QR and secret codes").click()
    await expect(page.getByText("Step 2: Verify")).toBeVisible()

    const secretText = await page.getByText(/Secret:/).textContent()
    const secret = secretText?.split("Secret:")[1].trim()!

    const code = authenticator.generate(secret)

    await page.getByPlaceholder("6-digit code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Enable" }).click()

    await expect(page.getByText("Enabling")).toBeVisible()
    await expect(page.getByText("Step 3: Backup")).toBeVisible({ timeout: 15000 })

    await page.getByRole("list").getByRole("button").first().click()

    const clipboard = await page.evaluate(_ => navigator.clipboard.readText())
    expect(clipboard.length).toEqual(6 * 2 * 10 + 9)

    const backupCodes = clipboard.split("\n")
    expect(backupCodes.length).toEqual(10)

    await page.getByText("I have backed up the codes").click()
    await page.getByRole("button", { name: "Close" }).click()

    await page.reload()

    return { user, backupCodes }
}

async function signupWithMFAEnabled(page: Page) {
    const user = await signupWithMFAEnabledAndLogin(page)

    await page.getByTestId("open-settings").click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("/login")

    return user
}