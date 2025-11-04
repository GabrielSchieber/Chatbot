import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router"
import { useEffect, useState } from "react"

import { useAuth } from "./context/AuthProvider"
import { NotificationProvider } from "./context/NotificationProvider"
import Index from "./pages/Index"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import { getLanguageAbbreviation } from "./utils/language"
import { applyTheme } from "./utils/theme"
import "./App.css"
import i18n from "./i18n"

export default function App() {
    const { user, loading, isLoggedIn } = useAuth()

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
                    <Route path="/" element={isLoggedIn ? <Index /> : <Navigate to="/login" replace />} />
                    <Route path="/chat/:chatUUID" element={isLoggedIn ? <Index /> : <Navigate to="/login" replace />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Router>
        </NotificationProvider>
    )
}