import { Cross1Icon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { TooltipButton } from "./Buttons"
import ConfirmDialog from "./ConfirmDialog"
import { useChat } from "../../context/ChatProvider"
import { archiveOrUnarchiveChat, archiveOrUnarchiveChats, deleteChat, getArchivedChats, getChats } from "../../utils/api"
import type { Chat } from "../../types"

export function ArchivedChatsDialog({ triggerClassName, getSidebarChatsLimit }: { triggerClassName: string, getSidebarChatsLimit: () => number }) {
    const { setCurrentChat, setChats } = useChat()

    const loaderRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)

    const [entries, setEntries] = useState<Chat[]>([])

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    const limit = 15

    function loadEntries(reset: boolean) {
        if (isLoadingRef.current || isLoading) return

        isLoadingRef.current = true
        setIsLoading(true)

        getArchivedChats(reset ? 0 : offset, limit).then(response => {
            if (response.ok) {
                response.json().then((data: { chats: Chat[], has_more: boolean }) => {
                    setEntries(previous => {
                        const combined = reset ? data.chats : [...previous, ...data.chats]
                        const unique = Array.from(new Map(combined.map(c => [c.uuid, c])).values())
                        return unique
                    })
                    setOffset(previous => (reset ? limit : previous + limit))
                    setHasMore(data.has_more)
                    setIsLoading(false)
                    isLoadingRef.current = false
                })
            }
        })
    }

    function handleUnarchive(chat: Chat) {
        archiveOrUnarchiveChat(chat.uuid, false)
        setEntries(previous => previous.filter(p => p.uuid !== chat.uuid))
        setChats(previous => [...previous, chat].sort((a, b) => a.index - b.index))
        setCurrentChat(previous => previous?.uuid === chat.uuid ? { ...previous, is_archived: false } : previous)
    }

    function handleArchiveAll() {
        archiveOrUnarchiveChats(true).then(response => {
            if (response.ok) {
                loadEntries(true)
            }
        })
        setChats([])
        setCurrentChat(previous => previous ? { ...previous, is_archived: true } : previous)
    }

    function handleUnarchiveAll() {
        archiveOrUnarchiveChats(false).then(response => {
            if (response.ok) {
                getChats(0, getSidebarChatsLimit()).then(response => {
                    if (response.ok) {
                        response.json().then(data => {
                            setChats(data.chats)
                            setEntries([])
                        })
                    }
                })
            }
        })
        setCurrentChat(previous => previous ? { ...previous, is_archived: false } : previous)
    }

    function handleDelete(uuid: string) {
        deleteChat(uuid).then(response => {
            if (response.ok) {
                setChats(previous => {
                    let previousChats = [...previous]
                    previousChats = previousChats.filter(c => c.uuid !== uuid)
                    return previousChats
                })
                if (location.pathname.includes(uuid)) {
                    location.href = "/"
                }
            }
        })
    }

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadEntries(false)
            }
        })

        if (loaderRef.current) observer.observe(loaderRef.current)
        return () => observer.disconnect()
    }, [hasMore, isLoading])

    return (
        <Dialog.Root onOpenChange={o => o && loadEntries(true)}>
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
                        className="flex flex-col w-full max-h-[50vh] gap-3 p-3 overflow-y-auto"
                        style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
                    >
                        {isLoading && entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">Loading...</p>
                        ) : entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">You don't have any archived chats.</p>
                        ) : (
                            <>
                                {entries.map(c => (
                                    <a
                                        key={c.uuid}
                                        className="flex gap-2 px-2 py-1 items-center justify-between rounded-lg hover:bg-gray-700 light:hover:bg-gray-300"
                                        href={`/chat/${c.uuid}`}
                                        data-testid="archived-chat-entry"
                                    >
                                        {c.title}
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
                                                    handleUnarchive(c)
                                                }}
                                                tooltipSize="xs"
                                            />
                                            <TooltipButton
                                                trigger={
                                                    <ConfirmDialog
                                                        trigger={<Cross1Icon className="size-4" />}
                                                        title="Delete Archived Chat"
                                                        description={`Are you sure you want to delete "${c.title}"? This action cannot be undone.`}
                                                        confirmText="Delete"
                                                        cancelText="Cancel"
                                                        onConfirm={() => handleDelete(c.uuid)}
                                                    />
                                                }
                                                onClick={e => e.preventDefault()}
                                                tooltip="Delete"
                                                className="p-1.5 rounded-3xl text-red-500 cursor-pointer hover:bg-red-500/20"
                                                tooltipSize="xs"
                                            />
                                        </div>
                                    </a>
                                ))}

                                {isLoading && entries.length > 0 && (
                                    <p className="text-gray-400 light:text-gray-600 px-3 py-2">Loading...</p>
                                )}
                            </>
                        )}

                        {hasMore && <div ref={loaderRef} className="h-6"></div>}
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