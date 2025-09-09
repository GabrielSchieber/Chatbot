import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    use: {
        baseURL: "http://localhost:5173"
    },
    projects: [
        {
            name: "Set up database",
            testMatch: "setUp.ts"
        },
        {
            name: "Chromium with database",
            use: { ...devices["Desktop Chrome"] },
            dependencies: ["Set up database"]
        }
    ],
    webServer: [
        {
            name: "Backend",
            command: "cd ../backend && python manage.py flush --no-input && python manage.py runserver",
            port: 8000,
            reuseExistingServer: true
        },
        {
            name: "Frontend",
            command: "npm run dev",
            port: 5173,
            reuseExistingServer: true
        }
    ]
})