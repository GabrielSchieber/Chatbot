import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AuthProvider } from "./context/AuthProvider.tsx"
import App from "./App.tsx"
import "./i18n"

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </StrictMode>
)