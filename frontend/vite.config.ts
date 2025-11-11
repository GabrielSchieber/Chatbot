import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { env } from "process"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: [["babel-plugin-react-compiler"]]
            }
        }),
        tailwindcss()
    ],
    server: {
        proxy: {
            "/ws": {
                target: env.VITE_TARGET_URL,
                ws: true,
                secure: true
            }
        }
    }
})