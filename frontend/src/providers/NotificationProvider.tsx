import { CheckCircledIcon, CrossCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import { AnimatePresence, motion } from "motion/react"
import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([])

    const notify = useCallback((message: string, type: NotificationType = "info", timeout = 3000) => {
        const id = Date.now()
        setNotifications(previous => [...previous, { id, message, type, timeout }])
        setTimeout(() => setNotifications(previous => previous.filter(n => n.id !== id)), timeout)
    }, [])

    return (
        <NotificationContext.Provider value={notify}>
            {children}

            <div className="fixed flex flex-col w-[calc(100vw-10px)] space-y-2 items-center top-4 left-1/2 -translate-x-1/2 z-[9999]">
                <AnimatePresence>
                    {notifications.map((n) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            className={`
                                flex px-4 py-2 items-center space-x-2 rounded-2xl shadow-lg text-white
                                ${n.type === "success" ? "bg-green-600" : ""}
                                ${n.type === "error" ? "bg-red-600" : ""}
                                ${n.type === "warning" ? "bg-yellow-500" : ""}
                                ${n.type === "info" ? "bg-blue-600" : ""}
                            `}
                        >
                            {n.type === "success" && <CheckCircledIcon className="min-w-5 max-w-5 min-h-5 max-h-5" />}
                            {n.type === "error" && <CrossCircledIcon className="min-w-5 max-w-5 min-h-5 max-h-5" />}
                            {n.type === "warning" && <ExclamationTriangleIcon className="min-w-5 max-w-5 min-h-5 max-h-5" />}
                            {n.type === "info" && <InfoCircledIcon className="min-w-5 max-w-5 min-h-5 max-h-5" />}
                            <span>{n.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </NotificationContext.Provider>
    )
}

export function useNotify() {
    const context = useContext(NotificationContext)
    if (!context) throw new Error("useNotify must be used within a NotificationProvider")
    return context
}

type NotificationType = "success" | "error" | "warning" | "info"

type Notification = {
    id: number
    message: string
    type: NotificationType
    timeout: number
}

type NotificationContextType = (message: string, type?: NotificationType, timeout?: number) => void

const NotificationContext = createContext<NotificationContextType | null>(null)