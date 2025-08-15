import { useEffect, useRef, useState } from "react"
import { useTheme } from "../../context/ThemeProvider"
import type { Theme } from "../../utils/theme"
import "./Settings.css"
import { logout } from "../../utils/auth"
import { deleteAccount, deleteChats } from "../../utils/api"

interface SettingsProps {
    popup: React.RefObject<HTMLDivElement | null>
    confirmPopup: {
        message: string
        onConfirm: () => void
        onCancel?: (() => void) | undefined
    } | null
    setConfirmPopup: React.Dispatch<React.SetStateAction<{
        message: string
        onConfirm: () => void
        onCancel?: () => void
    } | null>>
    closePopup: () => void
}

export default function Settings({ popup, confirmPopup, setConfirmPopup, closePopup }: SettingsProps) {
    const { theme, setTheme } = useTheme()

    const ref = useRef<HTMLDivElement | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [isHiding, setIsHiding] = useState(false)

    function deleteChatsPopup() {
        setConfirmPopup({
            message: "Are you sure you want to delete all of your chats?",
            onConfirm: () => {
                deleteChats().then(status => {
                    if (status !== 200) {
                        setConfirmPopup({
                            message: "Deletion of chats was not possible",
                            onConfirm: () => setConfirmPopup(null)
                        })
                    } else {
                        if (location.href.includes("/chat/")) {
                            location.href = "/"
                        } else {
                            closePopup()
                            document.getElementById("history-div")!.innerHTML = ""
                        }
                    }
                })
            },
            onCancel: () => closePopup()
        })
    }

    function deleteAccountPopup() {
        setConfirmPopup({
            message: "Are you sure you want to delete your account?",
            onConfirm: () => {
                deleteAccount().then(status => {
                    if (status !== 200) {
                        setConfirmPopup({
                            message: "Deletion of account was not possible",
                            onConfirm: () => setConfirmPopup(null)
                        })
                    } else {
                        location.href = "/"
                    }
                })
            },
            onCancel: () => closePopup()
        })
    }

    async function handleLogoutButton() {
        await logout()
        location.reload()
    }

    function closeSettings() {
        setIsHiding(true)
        setTimeout(() => {
            setIsHiding(false)
            setIsVisible(false)
        }, 300)
    }

    useEffect(() => {
        if (!isVisible) return

        function closeSettingsOnOutsideClick(event: MouseEvent) {
            if (confirmPopup) return

            const target = event.target as Node
            if (
                (ref.current && ref.current.contains(target)) ||
                (popup.current && popup.current.contains(target))
            ) {
                return
            }

            closeSettings()
        }

        document.addEventListener("mousedown", closeSettingsOnOutsideClick)
        return () => document.removeEventListener("mousedown", closeSettingsOnOutsideClick)
    }, [isVisible, confirmPopup])

    useEffect(() => {
        if (!isVisible) return

        function closeSettingsOnEscape(event: KeyboardEvent) {
            if (confirmPopup) return
            if (event.key === "Escape") {
                closeSettings()
            }
        }

        document.addEventListener("keydown", closeSettingsOnEscape)
        return () => document.removeEventListener("keydown", closeSettingsOnEscape)
    }, [isVisible, confirmPopup])

    return (
        <>
            {!isVisible && <button id="open-settings-button" onClick={_ => setIsVisible(true)}>⚙</button>}

            {isVisible && <div id="settings-backdrop-div"></div>}
            {(isVisible || isHiding) && (
                <div id="settings-div" className={isHiding ? "fade-out" : "fade-in"} ref={ref}>
                    <p id="settings-p">Settings</p>

                    <button id="close-settings-button" onClick={closeSettings}>X</button>

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
                        <button id="delete-chats-button" onClick={deleteChatsPopup}>Delete all</button>
                    </div>

                    <div id="delete-account-button-div">
                        <label id="delete-account-button-label">Delete account</label>
                        <button id="delete-account-button" onClick={deleteAccountPopup}>Delete</button>
                    </div>

                    <div id="logout-button-div">
                        <label id="logout-button-label">Log out</label>
                        <button id="logout-button" onClick={handleLogoutButton}>Log out</button>
                    </div>
                </div>
            )}
        </>
    )
}