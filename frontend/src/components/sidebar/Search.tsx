import { ChatBubbleIcon, Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { getChats, searchChats } from "../../utils/api"

export default function Search({ isSidebarOpen, itemClassNames }: { isSidebarOpen: boolean, itemClassNames: string }) {
    const entriesRef = useRef<HTMLDivElement | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const requestIDRef = useRef(0)

    const [search, setSearch] = useState("")
    const [entries, setEntries] = useState<SearchEntry[]>([])
    const [hasChats, setHasChats] = useState(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    async function loadEntries(reset: boolean, searchOverride?: string) {
        if (isLoading) return
        setIsLoading(true)

        const localRequestID = ++requestIDRef.current
        const currentSearch = searchOverride ?? search
        const limit = Math.round((window.innerHeight / 2) / 50)

        const response = await searchChats(currentSearch, reset ? 0 : offset, limit)
        if (requestIDRef.current === localRequestID && response.ok) {
            const data: { entries: SearchEntry[], has_more: boolean } = await response.json()
            if (requestIDRef.current === localRequestID) {
                setEntries(previous => {
                    const combined = reset ? data.entries : [...previous, ...data.entries]
                    const unique = Array.from(new Map(combined.map(c => [c.uuid, c])).values())
                    return unique
                })
                setOffset(previous => (reset ? limit : previous + limit))
                setHasMore(data.has_more)
                setIsLoading(false)
            }
        }

        setIsLoading(false)
    }

    useEffect(() => {
        getChats(0, 1).then(response => {
            if (response.ok) {
                response.json().then(data => setHasChats(data.chats.length > 0))
            }
        })
    }, [])

    useEffect(() => {
        if (!hasChats) return
        requestIDRef.current++
        setOffset(0)
        setEntries([])
        setHasMore(true)
        loadEntries(true)
        if (entriesRef.current) {
            entriesRef.current.scrollTop = 0
        }
    }, [search])

    useEffect(() => {
        if (!sentinelRef.current || !entriesRef.current) return

        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    loadEntries(false)
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
            onOpenChange={open => {
                if (open) {
                    requestIDRef.current++
                    setOffset(0)
                    setEntries([])
                    setHasMore(true)
                    loadEntries(true)
                }
            }}
        >
            <Dialog.Trigger className={itemClassNames} data-testid="search-chats">
                <MagnifyingGlassIcon className="size-5" /> {isSidebarOpen && "Search Chats"}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed flex flex-col w-150 items-center top-[20vh] left-1/2 -translate-x-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <Dialog.Title hidden>Search Chats</Dialog.Title>
                    <Dialog.Description hidden>Search Chats</Dialog.Description>

                    <div className="flex w-full gap-5 p-5 border-b border-gray-600 light:border-gray-400">
                        <input
                            className="flex-1 outline-none placeholder-gray-400 light:placeholder-gray-600"
                            type="text"
                            placeholder="Search chats..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    requestIDRef.current++
                                    setOffset(0)
                                    setEntries([])
                                    setHasMore(true)
                                    loadEntries(true, (e as any).currentTarget.value)
                                }
                            }}
                            autoFocus
                        />
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon className="size-4" />
                        </Dialog.Close>
                    </div>

                    <div
                        ref={entriesRef}
                        className="flex flex-col w-full max-h-[50vh] gap-2 px-2 py-4 items-center overflow-x-hidden overflow-y-auto"
                        style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
                    >
                        {entries.map(e => <Entry key={e.uuid} entry={e} />)}

                        {isLoading ? (
                            <p className="text-gray-400 light:text-gray-600">Loading...</p>
                        ) : !hasChats ? (
                            <p className="text-gray-400 light:text-gray-600">You have no chats to search.</p>
                        ) : entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600">No chats were found.</p>
                        ) : hasMore && (
                            <div ref={sentinelRef} className="h-1"></div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

type SearchEntry = { uuid: string, title: string, matches: string[], last_modified_at: string }

function Entry({ entry }: { entry: SearchEntry }) {
    const [isHovering, setIsHovering] = useState(false)

    return (
        <a
            className="flex w-full gap-3 px-3 py-2 items-center justify-between rounded-lg border border-gray-600 light:border-gray-400 hover:bg-gray-600/10 light:hover:bg-gray-300/10"
            href={`/chat/${entry.uuid}`}
            onMouseEnter={_ => setIsHovering(true)}
            onMouseLeave={_ => setIsHovering(false)}
        >
            <div className="flex flex-col gap-3 items-center">
                <ChatBubbleIcon className="size-8" />
                <p className={`text-sm text-nowrap transition ${!isHovering && "opacity-0"}`}>
                    {entry.last_modified_at}
                </p>
            </div>

            <div className="flex flex-1 flex-col gap-2 justify-between">
                <p className="px-2 rounded text-lg font-semibold bg-gray-600/50 light:bg-gray-300/50">{entry.title}</p>

                {entry.matches.length > 0 &&
                    <ul className="flex flex-col gap-1">
                        {entry.matches.slice(0, 5).map((m, i) =>
                            <li key={i} className="px-2 rounded bg-gray-600/30 light:bg-gray-300/30">{m.slice(0, 100)}...</li>
                        )}
                    </ul>
                }
            </div>
        </a>
    )
}