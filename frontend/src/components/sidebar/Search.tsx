import { ArchiveIcon, ChatBubbleIcon, Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import i18next, { t } from "i18next"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { useChat } from "../../context/ChatProvider"
import { searchChats } from "../../utils/api"

export default function Search({ showLabel, itemClassNames }: { showLabel: boolean, itemClassNames: string }) {
    const { chats, isMobile } = useChat()

    const entriesRef = useRef<HTMLDivElement | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const requestIDRef = useRef(0)
    const loadingCountRef = useRef(0)

    const [search, setSearch] = useState("")
    const [entries, setEntries] = useState<SearchEntry[]>([])
    const [isOpen, setIsOpen] = useState(false)

    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    const hasChats = chats.length > 0

    async function loadEntries(reset: boolean, searchOverride?: string) {
        if (!reset && loadingCountRef.current > 0) return

        loadingCountRef.current++
        setIsLoading(true)

        const localRequestID = requestIDRef.current
        const currentSearch = searchOverride ?? search
        const offset = reset ? 0 : entries.length
        const limit = Math.round((window.innerHeight / 2) / 50)

        try {
            const response = await searchChats(currentSearch, offset, limit)
            if (requestIDRef.current === localRequestID && response.ok) {
                const data: { entries: SearchEntry[], has_more: boolean } = await response.json()
                if (requestIDRef.current === localRequestID) {
                    setEntries(previous => reset ? data.entries : [...previous, ...data.entries])
                    setHasMore(data.has_more)
                }
            }
        } finally {
            loadingCountRef.current = Math.max(0, loadingCountRef.current - 1)
            setIsLoading(loadingCountRef.current > 0)
        }
    }

    useEffect(() => {
        if (!hasChats || !isOpen) return

        const query = search
        const debounceMs = 300
        const timer = window.setTimeout(() => {
            requestIDRef.current++
            setEntries([])
            setHasMore(true)
            void loadEntries(true, query)
            if (entriesRef.current) {
                entriesRef.current.scrollTop = 0
            }
        }, debounceMs)

        return () => window.clearTimeout(timer)
    }, [search, hasChats])

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
        <Dialog.Root
            onOpenChange={async open => {
                setIsOpen(open)
                if (open) {
                    requestIDRef.current++
                    setEntries([])
                    setHasMore(true)
                    await loadEntries(true)
                }
            }}
        >
            <Dialog.Trigger className={itemClassNames} data-testid="search-chats">
                <MagnifyingGlassIcon className="size-5" /> {showLabel && t("sidebar.searchChats")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className={`
                        fixed flex flex-col items-center left-1/2 -translate-x-1/2
                        text-white light:text-black bg-gray-800 light:bg-gray-200
                        ${isMobile ? "inset-0 size-full" : "w-[75%] max-w-200 top-[10vh] max-h-[80vh] rounded-xl"}
                    `}
                >
                    <Dialog.Title hidden>{t("sidebar.searchChats")}</Dialog.Title>
                    <Dialog.Description hidden>{t("sidebar.searchChats")}</Dialog.Description>

                    <div className="flex w-full gap-5 p-5 border-b border-gray-600 light:border-gray-400">
                        <input
                            className="flex-1 outline-none placeholder-gray-400 light:placeholder-gray-600"
                            type="text"
                            placeholder={t("search.placeholder")}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={async e => {
                                if (e.key === "Enter") {
                                    requestIDRef.current++
                                    setEntries([])
                                    setHasMore(true)
                                    await loadEntries(true, (e as any).currentTarget.value)
                                }
                            }}
                            autoFocus
                        />
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon className="size-4" />
                        </Dialog.Close>
                    </div>

                    <div ref={entriesRef} className="flex flex-col w-full gap-2 px-2 py-4 items-center overflow-y-auto">
                        {entries.map(e => <Entry key={e.uuid} entry={e} />)}

                        {isLoading ? (
                            <p className="text-gray-400 light:text-gray-600">{t("search.loading")}</p>
                        ) : !hasChats ? (
                            <p className="text-gray-400 light:text-gray-600">{t("search.empty")}</p>
                        ) : entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600">{t("search.noResults")}</p>
                        ) : hasMore && (
                            <div ref={sentinelRef} className="h-1"></div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

type SearchEntry = { uuid: string, title: string, is_archived: boolean, matches: string[], last_modified_at: string }

function Entry({ entry }: { entry: SearchEntry }) {
    return (
        <a
            className={`
                group flex w-full gap-3 px-3 py-2 items-center justify-between rounded-lg border
                border-gray-600 light:border-gray-400 hover:bg-gray-600/10 light:hover:bg-gray-400/10
                ${entry.is_archived && "text-white/60 light:text-black/60"}
            `}
            href={`/chat/${entry.uuid}`}
        >
            <div className="flex flex-col gap-3 items-center">
                {entry.is_archived ? (
                    <ArchiveIcon className="size-8" />
                ) : (
                    <ChatBubbleIcon className="size-8" />
                )}
                <p className={`text-sm text-nowrap duration-300 opacity-0 group-hover:opacity-100 group-focus:opacity-100`}>
                    {formatChatDate(entry.last_modified_at)}
                </p>
            </div>

            <div className="flex flex-1 flex-col gap-2 justify-between">
                <p className="px-2 rounded text-lg font-semibold bg-gray-600/50 light:bg-gray-400/40">{entry.title}</p>

                {entry.matches.length > 0 &&
                    <ul className="flex flex-col gap-1">
                        {entry.matches.slice(0, 5).map((m, i) =>
                            <li key={i} className="px-2 rounded bg-gray-600/30 light:bg-gray-300">{m.slice(0, 100)}...</li>
                        )}
                    </ul>
                }
            </div>
        </a>
    )
}

function formatChatDate(isoString: string): string {
    const date = new Date(isoString)
    const now = new Date()
    const differenceMonths = now.getTime() - date.getTime()
    const differenceDays = Math.floor(differenceMonths / (1000 * 60 * 60 * 24))

    const language = i18next.language || "en"

    if (differenceDays < 1) {
        return t("search.date.today")
    } else if (differenceDays === 1) {
        return t("search.date.yesterday")
    } else {
        return new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(date)
    }
}