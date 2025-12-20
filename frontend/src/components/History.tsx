import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { t } from "i18next"
import { DropdownMenu } from "radix-ui"
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import { ArchiveButton, DeleteButton, RenameButton } from "./Buttons"
import { useChat } from "../providers/ChatProvider"
import { useNotify } from "../providers/NotificationProvider"
import { getChats, renameChat } from "../utils/api"
import type { Chat } from "../utils/types"

export default function History({ isSidebarOpen, sidebarRef }: { isSidebarOpen: boolean, sidebarRef: React.RefObject<HTMLDivElement | null> }) {
    const { chatUUID } = useParams()

    const { chats, setChats } = useChat()
    const notify = useNotify()

    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    const [renameUUID, setRenameUUID] = useState("")
    const [renameTitle, setRenameTitle] = useState("")

    const [isHoveringUUID, setIsHoveringUUID] = useState("")
    const [isFocusingUUID, setIsFocusingUUID] = useState("")
    const [isOpenUUID, setIsOpenUUID] = useState("")

    async function loadEntries(reset: boolean) {
        if (isLoadingRef.current || isLoading) return
        isLoadingRef.current = true
        setIsLoading(true)

        const height = sidebarRef.current?.clientHeight || 1
        const limit = Math.max(Math.round(height / 30), 1)

        const response = await getChats(reset ? 0 : offset, limit)
        if (response.ok) {
            const data: { chats: Chat[], has_more: boolean } = await response.json()
            setChats(previous => Array.from(new Map([...previous, ...data.chats].map(c => [c.uuid, c])).values()))
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
        const newTitle = renameTitle.trim()
        if (newTitle && renameTitle !== chat.title) {
            const response = await renameChat(chat.uuid, newTitle)
            if (response.ok) {
                setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, title: newTitle } : c))
            } else {
                notify(t("history.error.rename", { title: chat.title }))
            }
        }

        setRenameUUID("")
        setRenameTitle("")
    }

    useEffect(() => {
        setChats([])
        setOffset(0)
        setHasMore(true)
        loadEntries(true)
    }, [])

    useEffect(() => {
        if (!sentinelRef.current || !sidebarRef.current) return

        const observer = new IntersectionObserver(
            async entries => {
                if (entries[0].isIntersecting) {
                    await loadEntries(false)
                }
            },
            {
                root: sidebarRef.current,
                rootMargin: "10px"
            }
        )

        observer.observe(sentinelRef.current)
        return () => observer.disconnect()
    }, [hasMore, isLoading])

    return (
        <div className={`flex flex-col grow gap-1 px-2 py-4 items-center justify-items-center ${!isSidebarOpen && "hidden"}`} data-testid="history">
            {chats.filter(c => !c.is_archived && !c.is_temporary).sort((a, b) => a.index - b.index).map(c => (
                renameUUID === c.uuid ? (
                    <input
                        key={`input-${c.uuid}`}
                        className="w-full px-2 py-1 outline-none rounded-lg bg-gray-700 light:bg-gray-300"
                        type="text"
                        value={renameTitle}
                        onChange={e => setRenameTitle(e.target.value)}
                        onBlur={_ => confirmRename(c)}
                        onKeyDown={e => {
                            if (e.key === "Enter") {
                                confirmRename(c)
                            } else if (e.key === "Escape") {
                                setRenameUUID("")
                            }
                        }}
                        autoFocus
                    />
                ) : (
                    <a
                        key={`a-${c.uuid}`}
                        className={`
                            flex w-full gap-2 px-2 py-1 items-center justify-between rounded-lg outline-none
                            hover:bg-gray-600 light:hover:bg-gray-400/40
                            focus:bg-gray-600 light:focus:bg-gray-400/40
                            ${c.uuid === chatUUID ? "bg-gray-700 light:bg-gray-300" : c.uuid === isOpenUUID && "bg-gray-600 light:bg-gray-400/40"}
                        `}
                        href={`/chat/${c.uuid}`}
                        title={c.title}
                        onMouseEnter={_ => setIsHoveringUUID(c.uuid)}
                        onMouseLeave={_ => setIsHoveringUUID("")}
                        onFocus={_ => setIsFocusingUUID(c.uuid)}
                        onBlur={e => {
                            const related = (e as React.FocusEvent<HTMLAnchorElement>).relatedTarget as Node | null
                            if (related && e.currentTarget.contains(related)) return
                            setIsHoveringUUID("")
                            setIsFocusingUUID("")
                        }}
                    >
                        <p className="truncate">{c.title}</p>

                        <DropdownMenu.Root
                            open={isOpenUUID === c.uuid}
                            onOpenChange={o => {
                                setIsHoveringUUID(o ? c.uuid : "")
                                setIsFocusingUUID(o ? c.uuid : "")
                                setIsOpenUUID(o ? c.uuid : "")
                            }}
                            modal={false}
                        >
                            <DropdownMenu.Trigger
                                className={`
                                    ${isHoveringUUID !== c.uuid && isFocusingUUID !== c.uuid && isOpenUUID !== c.uuid ?
                                        "hidden hover-none:block pointer-coarse:block touch:block" : "block"}
                                    py-1 rounded cursor-pointer outline-none
                                    hover:bg-gray-500/50 light:hover:bg-gray-400/60
                                    focus:bg-gray-500/50 light:focus:bg-gray-400/60
                                `}
                                onClick={e => e.preventDefault()}
                                aria-label="Toggle chat options"
                            >
                                <DotsVerticalIcon />
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="z-10 flex flex-col p-2 rounded-xl shadow-xl/50 border border-gray-500 bg-gray-800 light:bg-gray-200"
                                    sideOffset={4}
                                    align="start"
                                    alignOffset={-10}
                                >
                                    <RenameButton onSelect={() => startRename(c)} />
                                    <ArchiveButton chat={c} />
                                    <DeleteButton chat={c} />
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                    </a>
                )
            ))}

            {isLoading && isLoadingRef.current ? (
                <p className="text-center text-gray-400 light:text-gray-600">{t("history.loading")}</p>
            ) : chats.filter(c => !c.is_archived && !c.is_temporary).length === 0 ? (
                <p className="text-center text-gray-400 light:text-gray-600">{t("history.empty")}</p>
            ) : hasMore && (
                <div ref={sentinelRef} className="h-1"></div>
            )}
        </div>
    )
}