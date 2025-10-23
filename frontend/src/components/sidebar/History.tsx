import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useEffect, useRef, useState, type RefObject } from "react"

import ConfirmDialog from "../ui/ConfirmDialog"
import { useChat } from "../../context/ChatProvider"
import { archiveChat, deleteChat, getChats, renameChat } from "../../utils/api"
import type { Chat } from "../../types"

export default function History({ sidebarRef, getSidebarChatsLimit }: { sidebarRef: RefObject<HTMLDivElement | null>, getSidebarChatsLimit: () => number }) {
    const offset = useRef(0)
    const isLoadingRef = useRef(true)

    const { setCurrentChat, chats, setChats } = useChat()

    const [isLoading, setIsLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)

    const [renameUUID, setRenameUUID] = useState("")
    const [renameTitle, setRenameTitle] = useState("")

    const [hoveringEntryIndex, setHoveringEntryIndex] = useState(-1)
    const [hoveringDropdownIndex, setHoveringDropdownIndex] = useState(-1)
    const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(-1)

    const dropdowmItemClassNames = "px-3 py-2 text-center cursor-pointer outline-none rounded-lg"
    const baseDropdowmItemClassNames = dropdowmItemClassNames + " hover:bg-gray-600 light:hover:bg-gray-400 focus:bg-gray-600 light:focus:bg-gray-400"

    async function loadMoreChats() {
        if (isLoading || !hasMore || !isLoadingRef.current) return
        setIsLoading(true)
        isLoadingRef.current = false

        const response = await getChats(offset.current, getSidebarChatsLimit())
        if (response.ok) {
            response.json().then((data: { chats: Chat[], has_more: boolean }) => {
                const newChats = data.chats

                if (newChats.length > 0) {
                    setChats(previous => {
                        const seen = new Set(previous.map(c => c.uuid))
                        return [...previous, ...newChats.filter(c => !seen.has(c.uuid))]
                    })
                    offset.current += newChats.length
                }

                setHasMore(data.has_more)
                setIsLoading(false)
                isLoadingRef.current = true
            })
        }
    }

    function startRename(chat: Chat) {
        setRenameUUID(chat.uuid)
        setRenameTitle(chat.title)
        setTimeout(() => document.querySelector("input")?.focus(), 100)
    }

    function confirmRename(chat: Chat) {
        if (renameTitle.trim() && renameTitle !== chat.title) {
            renameChat(chat.uuid, renameTitle.trim())
            setChats(previous => {
                const previousChats = [...previous]
                const chatToRename = previousChats.find(c => c.uuid === chat.uuid)
                if (chatToRename) {
                    chatToRename.title = renameTitle.trim()
                }
                return previousChats
            })
        }
        setRenameUUID("")
        setHoveringEntryIndex(-1)
        setSelectedDropdownIndex(-1)
        setHoveringDropdownIndex(-1)
    }

    function handleArchiveChat(uuid: string) {
        archiveChat(uuid)
        setChats(previous => previous.filter(p => p.uuid !== uuid))
        setCurrentChat(previous => previous?.uuid === uuid ? { ...previous, is_archived: true } : previous)
        setHoveringEntryIndex(-1)
        setSelectedDropdownIndex(-1)
        setHoveringDropdownIndex(-1)
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
        loadMoreChats()

        let previousHeight = window.innerHeight
        window.addEventListener("resize", _ => {
            if (window.innerHeight > previousHeight) {
                previousHeight = window.innerHeight
                loadMoreChats()
            }
        })
    }, [])

    useEffect(() => {
        const div = sidebarRef.current
        if (!div) return

        function onScroll() {
            if (div !== null && div.scrollTop + div.clientHeight >= div.scrollHeight - 50) {
                loadMoreChats()
            }
        }

        div.addEventListener("scroll", onScroll)
        return () => div.removeEventListener("scroll", onScroll)
    }, [offset.current, isLoading])

    return (
        <div className="flex-1 py-4">
            <p className="pl-3 text-sm text-gray-400">Chats</p>

            <div className="flex flex-col gap-1 p-2">
                {chats.map((c, i) => (
                    renameUUID === c.uuid ? (
                        <input
                            key={`input-${c.uuid}`}
                            className="px-2 py-1 outline-none rounded-lg bg-gray-700 light:bg-gray-300 focus:bg-gray-700 light:focus:bg-gray-300"
                            type="text"
                            value={renameTitle}
                            onChange={e => setRenameTitle(e.target.value)}
                            onBlur={_ => confirmRename(c)}
                            onKeyDown={e => {
                                if (e.key === "Enter") confirmRename(c)
                                if (e.key === "Escape") setRenameUUID("")
                            }}
                            autoFocus
                            data-testid="rename-input"
                        />
                    ) : (
                        <a
                            key={`a-${c.uuid}`}
                            className="flex px-2 py-1 items-center justify-between rounded-lg hover:bg-gray-700 light:hover:bg-gray-300"
                            href={(selectedDropdownIndex === i || hoveringDropdownIndex === i) ? undefined : `/chat/${c.uuid}`}
                            onFocus={_ => setHoveringEntryIndex(i)}
                            onBlur={e => {
                                const related = (e as React.FocusEvent<HTMLAnchorElement>).relatedTarget as Node | null
                                if (related && e.currentTarget.contains(related)) return
                                setHoveringEntryIndex(-1)
                            }}
                            onMouseEnter={_ => setHoveringEntryIndex(i)}
                            onMouseLeave={_ => setHoveringEntryIndex(-1)}
                            data-testid="history-entry"
                        >
                            {c.title}

                            {(hoveringEntryIndex === i || selectedDropdownIndex === i) &&
                                <DropdownMenu.Root onOpenChange={o => setSelectedDropdownIndex(o ? i : -1)} modal={false}>
                                    <DropdownMenu.Trigger
                                        className="
                                            py-1 cursor-pointer rounded outline-none
                                            hover:bg-gray-600 light:hover:bg-gray-400 focus:bg-gray-600 light:focus:bg-gray-400
                                        "
                                        onClick={e => e.preventDefault()}
                                    >
                                        <DotsVerticalIcon />
                                    </DropdownMenu.Trigger>

                                    <DropdownMenu.Content
                                        className="flex flex-col gap-1 p-2 rounded-xl translate-x-8 bg-gray-700 light:bg-gray-300"
                                        onMouseEnter={_ => setHoveringDropdownIndex(i)}
                                        onMouseLeave={_ => setHoveringDropdownIndex(-1)}
                                        sideOffset={4}
                                    >
                                        <DropdownMenu.Item className={baseDropdowmItemClassNames} onSelect={_ => startRename(c)}>
                                            Rename
                                        </DropdownMenu.Item>

                                        <DropdownMenu.Item className={baseDropdowmItemClassNames} onSelect={_ => handleArchiveChat(c.uuid)}>
                                            Archive
                                        </DropdownMenu.Item>

                                        <ConfirmDialog
                                            trigger={
                                                <DropdownMenu.Item
                                                    className={dropdowmItemClassNames + " text-red-400 hover:bg-red-400/20 focus:bg-red-400/20"}
                                                    onSelect={e => e.preventDefault()}
                                                >
                                                    Delete
                                                </DropdownMenu.Item>
                                            }
                                            title="Delete Chat"
                                            description={`Are you sure you want to delete "${c.title}"? This action cannot be undone.`}
                                            confirmText="Delete"
                                            cancelText="Cancel"
                                            onConfirm={() => handleDelete(c.uuid)}

                                        />
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            }
                        </a>
                    )
                ))}
            </div>

            {isLoading ? (
                <p className="text-center text-gray-400">Loading ...</p>
            ) : chats.length === 0 ? (
                <p className="text-center text-gray-400">You don't have any chats</p>
            ) : (!hasMore && chats.length > getSidebarChatsLimit()) && (
                <p className="text-center text-gray-400">No more chats</p>
            )}
        </div>
    )
}