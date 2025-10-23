import { ChatBubbleIcon, Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { getChats, searchChats } from "../../utils/api"

export default function Search({ isSidebarOpen, itemClassNames }: { isSidebarOpen: boolean, itemClassNames: string }) {
    type SearchEntry = { uuid: string, title: string, matches: string[], last_modified_at: string }

    const entriesRef = useRef<HTMLDivElement | null>(null)
    const loaderRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)
    const requestIDRef = useRef(0)

    const [search, setSearch] = useState("")
    const [entries, setEntries] = useState<SearchEntry[]>([])
    const [hasChats, setHasChats] = useState(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)
    const [hoveringEntryIndex, setHoveringEntryIndex] = useState(-1)

    const limit = 10

    function loadEntries(reset: boolean) {
        if (isLoadingRef.current || isLoading) return

        const localRequestId = ++requestIDRef.current
        isLoadingRef.current = true
        setIsLoading(true)
        const currentSearch = search

        searchChats(currentSearch, reset ? 0 : offset, limit).then(response => {
            if (requestIDRef.current !== localRequestId) {
                setIsLoading(false)
                isLoadingRef.current = false
                return
            }
            if (response.ok) {
                response.json().then((data: { entries: SearchEntry[], has_more: boolean }) => {
                    if (requestIDRef.current !== localRequestId) {
                        setIsLoading(false)
                        isLoadingRef.current = false
                        return
                    }
                    setEntries(previous => {
                        const combined = reset ? data.entries : [...previous, ...data.entries]
                        const unique = Array.from(new Map(combined.map(c => [c.uuid, c])).values())
                        return unique
                    })
                    setOffset(previous => (reset ? limit : previous + limit))
                    setHasMore(data.has_more)
                    setIsLoading(false)
                    isLoadingRef.current = false
                })
            } else {
                setIsLoading(false)
                isLoadingRef.current = false
            }
        }).catch(() => {
            if (requestIDRef.current !== localRequestId) return
            setIsLoading(false)
            isLoadingRef.current = false
        })
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
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadEntries(false)
            }
        })

        if (loaderRef.current) observer.observe(loaderRef.current)
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
                            autoFocus
                        />
                        <Dialog.Close className="p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon className="size-4" />
                        </Dialog.Close>
                    </div>

                    <div
                        ref={entriesRef}
                        className="flex flex-col w-full max-h-[50vh] gap-3 p-3 overflow-y-auto"
                        style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}
                    >
                        {!hasChats ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">You have no chats to search.</p>
                        ) : isLoading && entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">Loading...</p>
                        ) : entries.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">No chats found.</p>
                        ) : (
                            <>
                                {entries.map((e, i) => (
                                    <a
                                        key={e.uuid}
                                        className="flex gap-5 px-2 py-1 items-center rounded-lg hover:bg-gray-600 light:hover:bg-gray-300"
                                        href={`/chat/${e.uuid}`}
                                        onMouseEnter={_ => setHoveringEntryIndex(i)}
                                        onMouseLeave={_ => setHoveringEntryIndex(-1)}
                                    >
                                        <ChatBubbleIcon className="size-10" />
                                        <div className="flex flex-1 flex-col justify-between">
                                            <p>{e.title}</p>
                                            {e.matches.length > 0 && (
                                                <ul>
                                                    {e.matches.slice(0, 10).map((m, i) => (
                                                        <li key={i}>{m.slice(0, 100)}...</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        <p className={`text-nowrap transition ${hoveringEntryIndex !== i && "opacity-0"}`}>
                                            {e.last_modified_at}
                                        </p>
                                    </a>
                                ))}

                                {isLoading && entries.length > 0 && (
                                    <p className="text-gray-400 light:text-gray-600 px-3 py-2">Loading...</p>
                                )}
                            </>
                        )}

                        {hasMore && !isLoading && <div ref={loaderRef} className="h-6"></div>}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}