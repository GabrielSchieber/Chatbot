import { ChatBubbleIcon, Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { getChats, searchChats } from "../../utils/api"

export default function Search({ isSidebarOpen, itemClassNames }: { isSidebarOpen: boolean, itemClassNames: string }) {
    type SearchEntry = { title: string, matches: string[], uuid: string }

    const loaderRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)

    const [search, setSearch] = useState("")
    const [entries, setEntries] = useState<SearchEntry[]>([])
    const [hasChats, setHasChats] = useState(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    const limit = 10

    function loadEntries(reset = false) {
        if (isLoadingRef.current || isLoading) return

        isLoadingRef.current = true
        setIsLoading(true)

        searchChats(search, reset ? 0 : offset, limit).then(response => {
            if (response.ok) {
                response.json().then((data: { chats: SearchEntry[], has_more: boolean }) => {
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

    useEffect(() => {
        getChats(0, 1).then(response => {
            if (response.ok) {
                response.json().then(data => setHasChats(data.chats.length > 0))
            }
        })
    }, [])

    useEffect(() => {
        if (!hasChats) return
        setOffset(0)
        loadEntries(true)
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
        <Dialog.Root>
            <Dialog.Trigger
                className={itemClassNames}
                onClick={_ => {
                    setOffset(0)
                    loadEntries(true)
                }}
            >
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
                                {entries.map(e => (
                                    <a
                                        key={e.uuid}
                                        className="flex gap-5 px-2 py-1 items-center rounded-lg hover:bg-gray-600 light:hover:bg-gray-300"
                                        href={`/chat/${e.uuid}`}
                                    >
                                        <ChatBubbleIcon className="size-10" />
                                        <div className="flex flex-col">
                                            <p>{e.title}</p>
                                            {e.matches.length > 0 && (
                                                <ul>
                                                    {e.matches.slice(0, 10).map((m, i) => (
                                                        <li key={i}>{m.slice(0, 100)}...</li>
                                                    ))}
                                                </ul>
                                            )}
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