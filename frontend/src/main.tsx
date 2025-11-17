import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AuthProvider } from "./providers/AuthProvider.tsx"
import App from "./App.tsx"
import "./utils/i18n"

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </StrictMode>
)