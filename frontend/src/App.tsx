import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router"

import "./App.css"
import AuthPage from "./pages/AuthPage"
import ChatPage from "./pages/ChatPage"
import { useAuth } from "./utils/auth"

export default function App() {
  const { loading, isLoggedIn } = useAuth()
  if (loading) return <></>

  return (
    <Router>
      <Routes>
        <Route path="/" element={isLoggedIn ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/chat/:chatUUID" element={isLoggedIn ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthPage type="Login" />} />
        <Route path="/signup" element={<AuthPage type="Signup" />} />
      </Routes>
    </Router>
  )
}