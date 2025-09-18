import { defineConfig } from "@playwright/test"

export default defineConfig({
    use: {
        baseURL: "http://localhost:5173"
    },
    webServer: [
        {
            name: "Backend",
            command: "python ../backend/manage.py testserver --no-input tests/fixture.json",
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