import { defineConfig } from "@playwright/test"

export default defineConfig({
    fullyParallel: true,
    use: {
        baseURL: "http://localhost:5173"
    },
    webServer: [
        {
            name: "Backend",
            command: "cd ../backend && python manage.py flush --no-input && python manage.py runserver",
            port: 8000
        },
        {
            name: "Frontend",
            command: "npm run dev",
            port: 5173
        }
    ]
})