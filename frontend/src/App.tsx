import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router"

import { useAuth } from "./context/AuthProvider"
import Index from "./pages/Index"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import { applyTheme } from "./utils/theme"
import "./App.css"

export default function App() {
    const { user, loading, isLoggedIn } = useAuth()
    if (loading) return <></>
    if (user) applyTheme(user?.preferences.theme)

    return (
        <Router>
            <Routes>
                <Route path="/" element={isLoggedIn ? <Index /> : <Navigate to="/login" replace />} />
                <Route path="/chat/:chatUUID" element={isLoggedIn ? <Index /> : <Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    )
}