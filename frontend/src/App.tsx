import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router"

import "./App.css"
import AuthPage from "./pages/AuthPage"
import ChatPage from "./pages/ChatPage"
import { useAuth } from "./context/AuthProvider"
import { applyTheme } from "./utils/theme"

export default function App() {
    const { user, loading, isLoggedIn } = useAuth()
    if (loading) return <></>
    if (user) applyTheme(user?.theme)

    return (
        <Router>
            <Routes>
                <Route path="/" element={isLoggedIn ? <ChatPage /> : <Navigate to="/login" replace />} />
                <Route path="/chat/:chatUUID" element={isLoggedIn ? <ChatPage /> : <Navigate to="/login" replace />} />
                <Route path="/login" element={<AuthPage type="Login" />} />
                <Route path="/signup" element={<AuthPage type="Signup" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    )
}