import { expect, test } from "@playwright/test"
import { apiFetch, setUp } from "./utils"

setUp()

const email = "test@example.com"
const password = "testpassword"

test("user can sign up", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")
})

test("user can login", async ({ page }) => {
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

test("user can log out", async ({ page }) => {
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