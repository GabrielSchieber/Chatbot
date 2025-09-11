import { ChatBubbleIcon, Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"

import { getChats, searchChats } from "../utils/api"
import type { SearchEntry } from "../types"

export default function Search({ isSidebarOpen }: { isSidebarOpen: boolean }) {
    const [search, setSearch] = useState("")
    const [results, setResults] = useState<SearchEntry[]>([])
    const [hasChats, setHasChats] = useState(false)

    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const loaderRef = useRef<HTMLDivElement | null>(null)

    function fetchResults(reset = false) {
        searchChats(search, reset ? 0 : offset, 10).then(data => {
            if (reset) {
                setResults(data.chats)
                setOffset(10)
            } else {
                setResults(previous => [...previous, ...data.chats])
                setOffset(previous => previous + 10)
            }
            setHasMore(data.has_more)
        })
    }

    useEffect(() => {
        getChats(0, 1).then(response => setHasChats(response.chats.length > 0))
    }, [])

    useEffect(() => {
        if (!hasChats) return
        setOffset(0)
        fetchResults(true)
    }, [search])

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchResults(false)
            }
        })
        if (loaderRef.current) observer.observe(loaderRef.current)
        return () => observer.disconnect()
    }, [hasMore, offset])

    return (
        <Dialog.Root>
            <Dialog.Trigger
                className="
                    flex items-center gap-2 p-2 rounded outline-none cursor-pointer
                    hover:bg-gray-700 light:hover:bg-gray-300 focus:bg-gray-700 light:focus:bg-gray-300
                "
                onClick={_ => fetchResults(true)}
                data-testid="search"
            >
                <MagnifyingGlassIcon />
                {isSidebarOpen && <span>Search</span>}
            </Dialog.Trigger>

            <Dialog.Overlay className="fixed z-40 inset-0 bg-black/50" />

            <Dialog.Content
                className="
                    fixed z-50 flex flex-col w-150 items-center
                    top-[20vh] left-1/2 -translate-x-1/2
                    rounded-xl bg-gray-800 light:bg-gray-200
                "
            >
                <Dialog.Title hidden>Search</Dialog.Title>
                <div className="flex w-full px-5 py-5 gap-5 border-b border-gray-600 light:border-gray-400">
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

                <div className="flex flex-col w-full max-h-[50vh] overflow-y-auto gap-3 p-3">
                    {!hasChats ? (
                        <p className="text-gray-400 light:text-gray-600 px-3 py-2">You have no chats to search.</p>
                    ) : (
                        results.length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600 px-3 py-2">No chats found.</p>
                        ) : (
                            results.map(entry => (
                                <a
                                    key={entry.uuid}
                                    className="flex gap-5 px-2 py-1 items-center rounded-lg hover:bg-gray-600 light:hover:bg-gray-300"
                                    href={`/chat/${entry.uuid}`}
                                >
                                    <ChatBubbleIcon className="size-10" />
                                    <div className="flex flex-col">
                                        <p>{entry.title}</p>
                                        {entry.matches.length > 0 && (
                                            <ul>
                                                {entry.matches.map((m, i) => (
                                                    <li key={i}>{m.slice(0, 100)}...</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </a>
                            ))
                        ))}
                    {hasMore && <div ref={loaderRef} className="h-6"></div>}
                </div>
            </Dialog.Content>
        </Dialog.Root>
    )
}