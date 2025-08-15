import { useTheme } from "../../context/ThemeProvider"
import type { Theme } from "../../utils/theme"

interface SettingsProps {
    ref: React.RefObject<HTMLDivElement | null>
    isHiding: boolean
    close: () => void
    deleteChats: () => void
    deleteAccount: () => void
    logout: () => void
}

export default function Settings({ ref, isHiding, close, deleteChats, deleteAccount, logout }: SettingsProps) {
    const { theme, setTheme } = useTheme()

    return (
        <div id="settings-div" className={isHiding ? "fade-out" : "fade-in"} ref={ref}>
            <p id="settings-p">Settings</p>

            <button id="close-settings-button" onClick={close}>X</button>

            <div id="theme-select-div">
                <label id="theme-select-label">Theme</label>
                <select id="theme-select" value={theme} onChange={event => setTheme(event.target.value as Theme)}>
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>

            <div id="delete-chats-button-div">
                <label id="delete-chats-button-label">Delete all chats</label>
                <button id="delete-chats-button" onClick={deleteChats}>Delete all</button>
            </div>

            <div id="delete-account-button-div">
                <label id="delete-account-button-label">Delete account</label>
                <button id="delete-account-button" onClick={deleteAccount}>Delete</button>
            </div>

            <div id="logout-button-div">
                <label id="logout-button-label">Log out</label>
                <button id="logout-button" onClick={logout}>Log out</button>
            </div>
        </div>
    )
}