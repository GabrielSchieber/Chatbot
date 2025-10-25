import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import ConfirmDialog from "../ui/ConfirmDialog"
import { useChat } from "../../context/ChatProvider"
import { useNotify } from "../../context/NotificationProvider"
import { archiveChat, deleteChat, getChats, renameChat } from "../../utils/api"
import type { Chat } from "../../types"

export default function History() {
    const { setCurrentChat, chats, setChats } = useChat()
    const notify = useNotify()

    const entriesRef = useRef<HTMLDivElement | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    const [renameUUID, setRenameUUID] = useState("")
    const [renameTitle, setRenameTitle] = useState("")

    const [hoveringEntryUUID, setHoveringEntryUUID] = useState("")
    const [hoveringDropdownUUID, setHoveringDropdownUUID] = useState("")
    const [selectedDropdownUUID, setSelectedDropdownUUID] = useState("")

    const dropdownItemClassName = "px-3 py-2 rounded-xl cursor-pointer outline-none text-center"
    const nonDestructiveDropdownItemClassName = dropdownItemClassName + " text-white light:text-black hover:bg-gray-600 light:hover:bg-gray-400"
    const destructiveDropdownItemClassName = dropdownItemClassName + " text-red-500 hover:bg-red-500/20"

    async function loadEntries(reset: boolean) {
        if (isLoadingRef.current || isLoading) return
        isLoadingRef.current = true
        setIsLoading(true)

        const height = entriesRef.current?.clientHeight || 1
        const limit = Math.max(Math.round(height / 30), 1)

        const response = await getChats(reset ? 0 : offset, limit)
        if (response.ok) {
            const data: { chats: Chat[], has_more: boolean } = await response.json()
            setChats(previous => {
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

    function startRename(chat: Chat) {
        setRenameUUID(chat.uuid)
        setRenameTitle(chat.title)
        setTimeout(() => document.querySelector("input")?.focus(), 100)
    }

    async function confirmRename(chat: Chat) {
        if (renameTitle.trim() && renameTitle !== chat.title) {
            const response = await renameChat(chat.uuid, renameTitle.trim())
            if (response.ok) {
                setChats(previous => {
                    previous = [...previous]
                    const chatToRename = previous.find(c => c.uuid === chat.uuid)
                    if (chatToRename) {
                        chatToRename.title = renameTitle.trim()
                    }
                    return previous
                })
                setRenameUUID("")
                setHoveringEntryUUID("")
                setSelectedDropdownUUID("")
                setHoveringDropdownUUID("")
            } else {
                notify(`Renaming of "${chat.title}" was not possible.`)
            }
        }
    }

    async function handleArchiveChat(chat: Chat) {
        const response = await archiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.filter(p => p.uuid !== chat.uuid))
            setCurrentChat(previous => previous?.uuid === chat.uuid ? { ...previous, is_archived: true } : previous)
            setHoveringEntryUUID("")
            setSelectedDropdownUUID("")
            setHoveringDropdownUUID("")
        }
        else {
            notify(`Archival of "${chat.title}" was not possible.`)
        }
    }

    async function handleDelete(chat: Chat) {
        const response = await deleteChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.filter(c => c.uuid !== chat.uuid))
            if (location.pathname.includes(chat.uuid)) {
                location.href = "/"
            }
        } else {
            notify(`Deletion of "${chat.title}" was not possible.`)
        }
    }

    useEffect(() => {
        setChats([])
        setOffset(0)
        setHasMore(true)
        loadEntries(true)
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
                rootMargin: "10px"
            }
        )

        observer.observe(sentinelRef.current)
        return () => observer.disconnect()
    }, [hasMore, isLoading])

    return (
        <div ref={entriesRef} className="flex flex-col size-full gap-1 px-2 py-4 items-center overflow-x-hidden overflow-y-auto" data-testid="history">
            {chats.filter(c => !c.is_archived).map(c => (
                renameUUID === c.uuid ? (
                    <input
                        key={`input-${c.uuid}`}
                        className="w-full px-2 py-1 outline-none rounded-lg bg-gray-700 light:bg-gray-300"
                        type="text"
                        value={renameTitle}
                        onChange={e => setRenameTitle(e.target.value)}
                        onBlur={_ => confirmRename(c)}
                        onKeyDown={e => {
                            if (e.key === "Enter") confirmRename(c)
                            if (e.key === "Escape") setRenameUUID("")
                        }}
                        autoFocus
                    />
                ) : (
                    <a
                        key={`a-${c.uuid}`}
                        className="flex w-full px-2 py-1 items-center justify-between rounded-lg hover:bg-gray-700 light:hover:bg-gray-300"
                        href={(selectedDropdownUUID === c.uuid || hoveringDropdownUUID === c.uuid) ? undefined : `/chat/${c.uuid}`}
                        onFocus={_ => setHoveringEntryUUID(c.uuid)}
                        onBlur={e => {
                            const related = (e as React.FocusEvent<HTMLAnchorElement>).relatedTarget as Node | null
                            if (related && e.currentTarget.contains(related)) return
                            setHoveringEntryUUID("")
                        }}
                        onMouseEnter={_ => setHoveringEntryUUID(c.uuid)}
                        onMouseLeave={_ => setHoveringEntryUUID("")}
                    >
                        {c.title}

                        {(hoveringEntryUUID === c.uuid || selectedDropdownUUID === c.uuid) &&
                            <DropdownMenu.Root onOpenChange={o => setSelectedDropdownUUID(o ? c.uuid : "")} modal={false}>
                                <DropdownMenu.Trigger
                                    className="py-1 rounded cursor-pointer outline-none hover:bg-gray-600/70 light:hover:bg-gray-400/70"
                                    onClick={e => e.preventDefault()}
                                >
                                    <DotsVerticalIcon />
                                </DropdownMenu.Trigger>

                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className="flex flex-col p-2 rounded-xl bg-gray-700 light:bg-gray-300"
                                        onMouseEnter={_ => setHoveringDropdownUUID(c.uuid)}
                                        onMouseLeave={_ => setHoveringDropdownUUID("")}
                                        sideOffset={4}
                                    >
                                        <DropdownMenu.Item className={nonDestructiveDropdownItemClassName} onSelect={_ => startRename(c)}>
                                            Rename
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Item className={nonDestructiveDropdownItemClassName} onSelect={_ => handleArchiveChat(c)}>
                                            Archive
                                        </DropdownMenu.Item>

                                        <ConfirmDialog
                                            trigger={
                                                <DropdownMenu.Item className={destructiveDropdownItemClassName} onSelect={e => e.preventDefault()}>
                                                    Delete
                                                </DropdownMenu.Item>
                                            }
                                            title="Delete Chat"
                                            description={`Are you sure you want to delete "${c.title}"? This action cannot be undone.`}
                                            confirmText="Delete"
                                            cancelText="Cancel"
                                            onConfirm={() => handleDelete(c)}
                                        />
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        }
                    </a>
                )
            ))}

            {isLoading && isLoadingRef.current ? (
                <p className="text-gray-400 light:text-gray-600">Loading...</p>
            ) : chats.filter(c => !c.is_archived).length === 0 ? (
                <p className="text-gray-400 light:text-gray-600">You don't have any chats.</p>
            ) : hasMore && (
                <div ref={sentinelRef} className="h-1"></div>
            )}
        </div>
    )
}