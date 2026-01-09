import { defineConfig } from "@playwright/test"

export default defineConfig({
    fullyParallel: true,
    use: {
        baseURL: "http://localhost:5173"
    },
    projects: [
        {
            name: "desktop",
            use: {
                viewport: { width: 1920, height: 1080 }
            }
        },
        {
            name: "laptop",
            use: {
                viewport: { width: 1280, height: 720 }
            }
        },
        {
            name: "tablet",
            use: {
                hasTouch: true,
                isMobile: true,
                viewport: { width: 820, height: 1180 }
            }
        },
        {
            name: "phone",
            use: {
                hasTouch: true,
                isMobile: true,
                viewport: { width: 360, height: 640 }
            }
        }
    ],
    webServer: [
        {
            name: "Backend",
            command: "python ../backend/manage.py testserver tests/fixture.json --no-input",
            port: 8000,
            reuseExistingServer: true,
            env: { "PLAYWRIGHT_TEST": "True" }
        },
        {
            name: "Frontend",
            command: "npm run dev",
            port: 5173,
            reuseExistingServer: true
        }
    ]
})