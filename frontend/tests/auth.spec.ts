import { expect, test } from "@playwright/test"
import { authenticator } from "otplib"
import { apiFetch, getEmailBody, getRandomEmail, signupAndLogin, signupWithMFAEnabled, signupWithMFAEnabledAndLogin, waitForEmail } from "./utils"

test("user can sign up", async ({ page }) => {
    const email = getRandomEmail()
    const password = "testpassword"

    await page.goto("/signup")

    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Confirm Password", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Sign up", exact: true }).click()

    const emailData = await waitForEmail({ to: email, subject: "Verify your email" })
    const emailBody = await getEmailBody(emailData.ID)
    const beginLink = emailBody.Text.indexOf("http://")
    const endLink = emailBody.Text.slice(beginLink).indexOf("\n") + beginLink
    const verifyLink = emailBody.Text.slice(beginLink, endLink)

    await page.goto(verifyLink)
    await page.waitForURL("/")

    await expect(page.getByText("Chatbot")).toBeVisible()
    await expect(page.getByText("Log in")).not.toBeVisible()
    await expect(page.getByText("Sign up")).not.toBeVisible()

    const settingsButton = page.getByText("Settings")
    if (!(await settingsButton.isVisible())) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await settingsButton.click()

    await page.getByRole("tab", { name: "Account" }).click()
    await expect(page.getByText(email, { exact: true })).toBeVisible()
})

test("user cannot sign up with existing email", async ({ page }) => {
    const [email, password] = await signup()

    await page.goto("/login")

    await page.click("text=Sign up!")

    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email)
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password)
    await page.getByRole("textbox", { name: "Confirm Password", exact: true }).fill(password)

    await page.click("button")
    await expect(page.getByText("The email address is already registered. Please choose another one.", { exact: true })).toBeVisible()
})

test("user can login", async ({ page }) => {
    const [email, password] = await signup()

    await page.goto("/login")

    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email)
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password)

    await page.click("button")
    await page.waitForURL("/")
})

test("user cannot login with invalid email", async ({ page }) => {
    await page.goto("/login")

    await page.getByRole("textbox", { name: "Email", exact: true }).fill("invalid@example.com")
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("testpassword")

    await page.click("button")
    await expect(page.getByText("The email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user cannot login with invalid password", async ({ page }) => {
    const [email] = await signup()

    await page.goto("/login")

    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email)
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("invalidpassword")

    await page.click("button")
    await expect(page.getByText("The email and/or password are invalid.", { exact: true })).toBeVisible()
})

test("user can enable multi-factor authentication", async ({ page }) => {
    const user = await signupAndLogin(page)

    const settingsButton = page.getByText("Settings")
    if (!(await settingsButton.isVisible())) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await settingsButton.click()

    await page.getByRole("tab", { name: "Security" }).click()
    await page.getByText("Multi-factor authentication", { exact: true }).locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Setup", { exact: true })).toBeVisible()
    await expect(page.getByText("Generate QR and secret code.", { exact: true })).toBeVisible()

    await page.getByLabel("Password").fill(user.password)

    await page.getByText("Generate", { exact: true }).click()
    await expect(page.getByText("Step 2: Verify", { exact: true })).toBeVisible()

    const secret = await page.getByTestId("mfa-secret").textContent()
    const code = authenticator.generate(secret!)

    await page.getByPlaceholder("6-digit code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Enable", exact: true }).click()
    await expect(page.getByText("Enabling", { exact: true })).toBeVisible()

    await expect(page.getByText("Step 3: Backup", { exact: true })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText("Multi-factor authentication enabled successfully!", { exact: true })).toBeVisible()

    await page.getByText("I have backed up the codes.", { exact: true }).click()
    await page.getByRole("button", { name: "Close", exact: true }).click()
})

test("user can log in with multi-factor authentication", async ({ page }) => {
    const { user } = await signupWithMFAEnabled(page)

    await page.goto("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")

    await expect(page.getByText("Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter the 6-digit code from your authenticator app", { exact: true })).toBeVisible()

    const response = await apiFetch(`/test/get-mfa-secret/?email=${user.email}`, {})
    expect(response.status).toBe(200)

    const secret = await response.json()
    const code = authenticator.generate(secret)

    await page.fill("input", code)
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page.getByRole("button", { name: "Verifying", exact: true })).toBeVisible()

    await page.waitForURL("/")
})

test("user can disable multi-factor authentication", async ({ page }) => {
    const { user } = await signupWithMFAEnabledAndLogin(page)

    const settingsButton = page.getByText("Settings")
    if (!(await settingsButton.isVisible())) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await settingsButton.click()

    await page.getByRole("tab", { name: "Security" }).click()
    await page.getByText("Multi-factor authentication", { exact: true }).locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Disable", { exact: true })).toBeVisible()

    const response = await apiFetch(`/test/get-mfa-secret/?email=${user.email}`, {})
    expect(response.status).toBe(200)

    const secret = await response.json()
    const code = authenticator.generate(secret)

    await page.getByPlaceholder("6-digit code", { exact: true }).fill(code)
    await page.getByRole("button", { name: "Disable", exact: true }).click()
    await expect(page.getByText("Multi-factor authentication disabled successfully!", { exact: true })).toBeVisible()
    await expect(page.getByText("Step 2: Disabled", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Close", exact: true }).click()
})

test("user can login with multi-factor authentication backup codes", async ({ page }) => {
    const { user, backupCodes } = await signupWithMFAEnabled(page)

    await page.goto("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")

    await expect(page.getByText("Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter the 6-digit code from your authenticator app", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Use recovery code", exact: true }).click()

    await expect(page.getByText("Recover Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter one of your recovery codes", { exact: true })).toBeVisible()

    await page.fill("input", backupCodes[0])
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page.getByRole("button", { name: "Verifying", exact: true })).toBeVisible()

    await page.waitForURL("/")
})

test("user cannot login with an already used multi-factor authentication backup code", async ({ page }) => {
    test.setTimeout(60_000)

    const { user, backupCodes } = await signupWithMFAEnabled(page)

    async function tryToLoginWithCode(code: string, shouldSucceed: boolean) {
        await page.goto("/login")

        await page.fill("input[type='email']", user.email)
        await page.fill("input[type='password']", user.password)

        await page.click("button")

        await expect(page.getByText("Multi-Factor Authentication", { exact: true })).toBeVisible()
        await expect(page.getByText("Enter the 6-digit code from your authenticator app", { exact: true })).toBeVisible()

        await page.getByRole("button", { name: "Use recovery code", exact: true }).click()

        await expect(page.getByText("Recover Multi-Factor Authentication", { exact: true })).toBeVisible()
        await expect(page.getByText("Enter one of your recovery codes", { exact: true })).toBeVisible()

        await page.fill("input", code)
        await page.getByRole("button", { name: "Verify", exact: true }).click()
        await expect(page.getByRole("button", { name: "Verifying", exact: true })).toBeVisible()

        if (shouldSucceed) {
            await page.waitForURL("/")
        } else {
            await expect(page.getByText("The code is invalid.", { exact: true })).toBeVisible({ timeout: 20_000 })
        }
    }

    await tryToLoginWithCode(backupCodes[0], true)
    await page.waitForURL("/")

    await page.getByText("Settings").click()
    await page.getByRole("tab", { name: "Security" }).click()
    await page.getByRole("button", { name: "Log out", exact: true }).click()
    await page.goto("/login")

    await tryToLoginWithCode(backupCodes[0], false)
})

test("user can disable multi-factor authentication with a backup code", async ({ page }) => {
    const { backupCodes } = await signupWithMFAEnabledAndLogin(page)

    const settingsButton = page.getByText("Settings")
    if (!(await settingsButton.isVisible())) {
        await page.getByRole("banner").getByRole("button").first().click()
    }
    await settingsButton.click()

    await page.getByRole("tab", { name: "Security" }).click()
    await page.getByText("Multi-factor authentication", { exact: true }).locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Disable", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Use recovery code", exact: true }).click()
    await page.getByPlaceholder("12-character recovery code", { exact: true }).fill(backupCodes[0])
    await page.getByRole("button", { name: "Disable", exact: true }).click()
    await expect(page.getByText("Step 2: Disabled", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Close", exact: true }).click()
})

test("user cannot disable multi-factor authentication with an already used backup code", async ({ page }) => {
    test.setTimeout(60_000)

    const { user, backupCodes } = await signupWithMFAEnabled(page)

    await page.goto("/login")

    await page.fill("input[type='email']", user.email)
    await page.fill("input[type='password']", user.password)

    await page.click("button")

    await expect(page.getByText("Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter the 6-digit code from your authenticator app", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Use recovery code", exact: true }).click()

    await expect(page.getByText("Recover Multi-Factor Authentication", { exact: true })).toBeVisible()
    await expect(page.getByText("Enter one of your recovery codes", { exact: true })).toBeVisible()

    await page.fill("input", backupCodes[0])
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page.getByRole("button", { name: "Verifying", exact: true })).toBeVisible()

    await page.waitForURL("/")

    await page.getByText("Settings").click()

    await page.getByRole("tab", { name: "Security" }).click()
    await page.getByText("Multi-factor authentication", { exact: true }).locator("..").getByRole("button").click()
    await expect(page.getByText("Step 1: Disable", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Use recovery code", exact: true }).click()
    await page.getByPlaceholder("12-character recovery code", { exact: true }).fill(backupCodes[0])
    await page.getByRole("button", { name: "Disable", exact: true }).click()
    await expect(page.getByText("Disabling", { exact: true })).toBeVisible()

    await expect(page.getByText("The code is invalid.", { exact: true })).toBeVisible({ timeout: 20_000 })
})

async function signup() {
    const email = getRandomEmail()
    const password = "testpassword"

    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    expect(response.status).toBe(201)

    const emailData = await waitForEmail({ to: email, subject: "Verify your email" })
    const emailBody = await getEmailBody(emailData.ID)
    const emailContent = emailBody.HTML || emailBody.Text
    const token = emailContent.slice(emailContent.search("token=") + 6)
    const verifyResponse = await apiFetch("/api/verify-email/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token })
    })
    expect(verifyResponse.status).toBe(204)

    return [email, password]
}