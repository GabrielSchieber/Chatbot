import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
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
        strictPort: true,
        proxy: {
            "/api": "http://localhost:8000",
            "/ws": {
                target: "http://localhost:8000",
                ws: true
            }
        }
    }
})