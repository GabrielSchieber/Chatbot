import { Page } from "@playwright/test"

export function apiFetch(url: string, init: RequestInit) {
    return fetch(`http://localhost:8000${url}`, init)
}

export function getRandomEmail() {
    return `user_${crypto.randomUUID()}@example.com`
}

export async function signupAndLogin(page: Page) {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", getRandomEmail())
    await page.fill("input[type='password']", "testpassword")

    await page.click("button")
    await page.waitForURL("/")
}