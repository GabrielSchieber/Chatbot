import { useEffect, useState } from "react"
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router"

import CheckEmail from "./pages/auth/CheckEmail"
import ForgotPassword from "./pages/auth/ForgotPassword"
import ResetPassword from "./pages/auth/ResetPassword"
import VerifyEmail from "./pages/auth/VerifyEmail"
import Index from "./pages/Index"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import { useAuth } from "./providers/AuthProvider"
import { NotificationProvider } from "./providers/NotificationProvider"
import i18n from "./utils/i18n"
import { applyTheme, getLanguageAbbreviation } from "./utils/misc"
import "./App.css"

export default function App() {
    const { user, loading } = useAuth()

    const [hasSetTheme, setHasSetTheme] = useState(false)
    const [hasSetLanguage, setHasSetLanguage] = useState(false)

    useEffect(() => {
        if (loading) return
        applyTheme(user?.preferences.theme || "System")
        setHasSetTheme(true)
    }, [loading, user?.preferences.theme])

    useEffect(() => {
        if (loading) return
        if (user && user.preferences.language) {
            i18n.changeLanguage(getLanguageAbbreviation(user.preferences.language))
        } else {
            i18n.changeLanguage(navigator.languages?.[0] || navigator.language || "en")
        }
        setHasSetLanguage(true)
    }, [loading, user?.preferences.language])

    if (loading || !hasSetTheme || !hasSetLanguage) return <></>

    return (
        <NotificationProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/chat/:chatUUID" element={<Index />} />

                    <Route path="/signup" element={<Signup />} />
                    <Route path="/check-email" element={<CheckEmail />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />

                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Router>
        </NotificationProvider>
    )
}