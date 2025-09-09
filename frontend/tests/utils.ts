import { Page, test } from "@playwright/test"
import { spawnSync } from "child_process"

export function setUp() {
    test.beforeEach(async () => {
        const result = spawnSync("python", ["manage.py", "flush", "--no-input"], {
            cwd: "../backend",
            stdio: "inherit",
            env: { ...process.env }
        })

        if (result.status !== 0) {
            throw new Error("Failed to set database before each test.")
        }
    })
}

export function apiFetch(url: string, init: RequestInit) {
    return fetch(`http://localhost:8000${url}`, init)
}

export async function signupAndLogin(page: Page, email = "test@example.com", password = "testpassword") {
    await page.goto("/")
    await page.waitForURL("/login")

    await page.click("text=Sign up!")

    await page.fill("input[type='email']", email)
    await page.fill("input[type='password']", password)

    await page.click("button")
    await page.waitForURL("/")
}