import { expect, test } from "@playwright/test"
import { apiFetch, getRandomEmail } from "./utils"

const password = "testpassword"

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
    const email = getRandomEmail()

    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    expect(response.status).toBe(201)

    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await expect(page.getByRole("paragraph"), { message: "Email is already registered. Please choose another one." }).toBeVisible()
})

test("user can login", async ({ page }) => {
    const email = getRandomEmail()

    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    expect(response.status).toBe(201)

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
    await expect(page.getByRole("paragraph"), { message: "Email and/or password are invalid." }).toBeVisible()
})

test("user cannot login with invalid password", async ({ page }) => {
    const email = getRandomEmail()

    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    expect(response.status).toBe(201)

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", "invalidpassword")

    await page.click("button")
    await expect(page.getByRole("paragraph"), { message: "Email and/or password are invalid." }).toBeVisible()
})

test("user can log out", async ({ page }) => {
    const email = getRandomEmail()

    const response = await apiFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    expect(response.status).toBe(201)

    await page.goto("/")
    await page.waitForURL("/login")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")

    await page.getByText("Settings").click()
    await page.getByRole("button", { name: "Log out" }).click()
    await page.waitForURL("/")
})