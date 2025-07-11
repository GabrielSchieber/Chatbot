import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router"
import ChatPage from "./pages/ChatPage"
import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import { isLoggedIn } from "./auth"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={isLoggedIn() ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </Router>
  )
}

export default App