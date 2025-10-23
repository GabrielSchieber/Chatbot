import { Cross1Icon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { TooltipButton } from "./Buttons"
import ConfirmDialog from "./ConfirmDialog"
import { useChat } from "../../context/ChatProvider"
import { useNotify } from "../../context/NotificationProvider"
import { archiveChats, deleteChat, getArchivedChats, getChats, unarchiveChat, unarchiveChats } from "../../utils/api"
import type { Chat } from "../../types"

export function ArchivedChatsDialog({ triggerClassName, getSidebarChatsLimit }: { triggerClassName: string, getSidebarChatsLimit: () => number }) {
    const { setCurrentChat, chats, setChats } = useChat()
    const notify = useNotify()

    const entriesRef = useRef<HTMLDivElement | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)

    const [entries, setEntries] = useState<Chat[]>([])
    const [hasArchivedChats, setHasArchivedChats] = useState(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    async function loadEntries(reset: boolean) {
        if (isLoadingRef.current || isLoading) return
        isLoadingRef.current = true
        setIsLoading(true)

        const limit = Math.round((window.innerHeight / 2) / 30)

        const response = await getArchivedChats(reset ? 0 : offset, limit)
        if (response.ok) {
            const data: { chats: Chat[], has_more: boolean } = await response.json()
            setEntries(previous => {
                const combined = reset ? data.chats : [...previous, ...data.chats]
                const unique = Array.from(new Map(combined.map(c => [c.uuid, c])).values())
                return unique
            })
            setOffset(previous => (reset ? limit : previous + limit))
            setHasMore(data.has_more)
        }

        setIsLoading(false)
        isLoadingRef.current = false
    }

    async function handleArchiveAll() {
        const response = await archiveChats()
        if (response.ok) {
            if (chats.length > 0) {
                setHasArchivedChats(true)
            }
            await loadEntries(true)
            setChats([])
            setCurrentChat(previous => previous ? { ...previous, is_archived: true } : previous)
        } else {
            notify("Archival of all chats was not possible. Please try again later.", "error")
        }
    }

    async function handleUnarchiveAll() {
        const response = await unarchiveChats()
        if (response.ok) {
            setHasArchivedChats(false)
            setEntries([])
            setCurrentChat(previous => previous ? { ...previous, is_archived: false } : previous)

            const response = await getChats(0, getSidebarChatsLimit())
            if (response.ok) {
                const data = await response.json()
                setChats(data.chats)
            }
        } else {
            notify("Unarchival of all chats was not possible. Please try again later.", "error")
        }
    }

    async function handleUnarchive(chat: Chat) {
        const response = await unarchiveChat(chat.uuid)
        if (response.ok) {
            if (entries.length === 1) {
                setHasArchivedChats(false)
            }
            setEntries(previous => previous.filter(p => p.uuid !== chat.uuid))
            setChats(previous => [...previous, chat].sort((a, b) => a.index - b.index))
            setCurrentChat(previous => previous?.uuid === chat.uuid ? { ...previous, is_archived: false } : previous)
        } else {
            notify(`Unarchival of "${chat.title}" was not possible. Please try again later.`, "error")
        }
    }

    async function handleDelete(chat: Chat) {
        const response = await deleteChat(chat.uuid)
        if (response.ok) {
            if (entries.length === 1) {
                setHasArchivedChats(false)
            }
            setEntries(previous => previous.filter(c => c.uuid !== chat.uuid))
            setChats(previous => previous.filter(c => c.uuid !== chat.uuid))

            if (location.pathname.includes(chat.uuid)) {
                location.href = "/"
            }
        } else {
            notify(`Deletion of "${chat.title}" was not possible. Please try again later.`, "error")
        }
    }

    useEffect(() => {
        getArchivedChats(0, 1).then(async response => {
            if (response.ok) {
                const data = await response.json()
                setHasArchivedChats(data.chats.length > 0)
            }
        })
    }, [])

    useEffect(() => {
        if (!sentinelRef.current || !entriesRef.current) return

        const observer = new IntersectionObserver(
            async entries => {
                if (entries[0].isIntersecting) {
                    await loadEntries(false)
                }
            },
            {
                root: entriesRef.current,
                rootMargin: "50px"
            }
        )

        observer.observe(sentinelRef.current)
        return () => observer.disconnect()
    }, [hasMore, isLoading])

    return (
        <Dialog.Root
            onOpenChange={async open => {
                if (open) {
                    setOffset(0)
                    setEntries([])
                    setHasMore(true)
                    await loadEntries(true)
                }
            }}>
            <Dialog.Trigger className={triggerClassName}>
                Manage
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed flex flex-col w-150 top-[20vh] left-1/2 -translate-x-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <div className="flex p-4 items-center justify-between border-b">
                        <Dialog.Title className="text-lg font-semibold">Archived Chats</Dialog.Title>
                        <Dialog.Description hidden>Manage archived chats</Dialog.Description>
                        <div className="flex items-center gap-3">
                            <ArchiveOrUnarchiveDialog action="archive" onConfirm={handleArchiveAll} />
                            <ArchiveOrUnarchiveDialog action="unarchive" onConfirm={handleUnarchiveAll} />
                            <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-200" data-testid="close-settings">
                                <Cross1Icon className="size-5" />
                            </Dialog.Close>
                        </div>
                    </div>

                    <div
                        ref={entriesRef}
                        className="flex flex-col w-full max-h-[50vh] gap-3 p-3 overflow-y-auto"
                        style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
                        data-testid="archived-chats"
                    >
                        {!hasArchivedChats ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">You don't have any archived chats.</p>
                        ) : isLoading && entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">Loading...</p>
                        ) : (
                            entries.map(c => (
                                <Entry key={c.uuid} chat={c} handleUnarchive={handleUnarchive} handleDelete={handleDelete} />
                            ))
                        )}

                        {isLoading && entries.length > 0 && (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">Loading...</p>
                        )}

                        {hasMore && !isLoading && <div ref={sentinelRef} className="h-6"></div>}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function ArchiveOrUnarchiveDialog({ action, onConfirm }: { action: "archive" | "unarchive", onConfirm: () => void }) {
    const label = action === "archive" ? "Archive" : "Unarchive"

    return (
        <ConfirmDialog
            trigger={
                <button className="px-3 py-1 rounded-3xl cursor-pointer bg-gray-700/50 hover:bg-gray-700 light:bg-gray-300/50 light:hover:bg-gray-300">
                    {label} all
                </button>
            }
            title={`${label} all chats`}
            description={`Are you sure you want to ${label.toLowerCase()} all of your chats?`}
            confirmText={`${label} all`}
            onConfirm={onConfirm}
            isDestructive={false}
        />
    )
}

function Entry({ chat, handleUnarchive, handleDelete }: { chat: Chat, handleUnarchive: (chat: Chat) => void, handleDelete: (chat: Chat) => void }) {
    return (
        <a
            className="flex gap-2 px-2 py-1 items-center justify-between rounded-lg hover:bg-gray-700 light:hover:bg-gray-300"
            href={`/chat/${chat.uuid}`}
            data-testid="archived-chat-entry"
        >
            {chat.title}
            <div className="flex gap-1 items-center">
                <TooltipButton
                    trigger={
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                            <rect width="20" height="5" x="2" y="3" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h2" />
                            <path d="M20 8v11a2 2 0 0 1-2 2h-2" />
                            <path d="m9 15 3-3 3 3" />
                            <path d="M12 12v9" />
                        </svg>}
                    tooltip="Unarchive"
                    className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-500/40"
                    onClick={e => {
                        e.preventDefault()
                        handleUnarchive(chat)
                    }}
                    tooltipSize="xs"
                />
                <TooltipButton
                    trigger={
                        <ConfirmDialog
                            trigger={<Cross1Icon className="size-4" />}
                            title="Delete Archived Chat"
                            description={`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`}
                            confirmText="Delete"
                            cancelText="Cancel"
                            onConfirm={() => handleDelete(chat)}
                        />
                    }
                    onClick={e => e.preventDefault()}
                    tooltip="Delete"
                    className="p-1.5 rounded-3xl text-red-500 cursor-pointer hover:bg-red-500/20"
                    tooltipSize="xs"
                />
            </div>
        </a>
    )
}