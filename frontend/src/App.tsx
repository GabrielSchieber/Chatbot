import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router"
import "./App.css"
import ChatPage from "./pages/ChatPage"
import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import { useAuth } from "./utils/auth"

export default function App() {
  const { loading, isLoggedIn } = useAuth()
  if (loading) return <></>

  return (
    <Router>
      <Routes>
        <Route path="/" element={isLoggedIn ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/chat/:chatUUID" element={isLoggedIn ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </Router>
  )
}