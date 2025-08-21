import { Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import type { Chat, SearchEntry } from "../types"
import { searchChats } from "../utils/api"
import { useState } from "react"

export default function Search({ isSidebarOpen, chats }: { isSidebarOpen: boolean, chats: Chat[] }) {
    const [results, setResults] = useState<SearchEntry[]>([])

    function search(search: string) {
        chats.length > 0 && searchChats(search).then(chats => chats && setResults(chats))
    }

    return (
        <Dialog.Root>
            <Dialog.Trigger
                className="
                    flex items-center gap-2 p-2 rounded outline-none cursor-pointer
                    hover:bg-gray-700 light:hover:bg-gray-300 focus:bg-gray-700 light:focus:bg-gray-300
                "
                onClick={_ => search("")}
            >
                <MagnifyingGlassIcon />
                {isSidebarOpen && <span>Search</span>}
            </Dialog.Trigger>

            <Dialog.Overlay className="fixed inset-0 bg-black/50" />

            <Dialog.Content
                className="
                    fixed top-[20vh] left-1/2 w-[700px] max-w-[90vw] -translate-x-1/2
                    bg-gray-800 rounded-2xl shadow-lg p-4
                    light:bg-gray-200
                "
            >
                <Dialog.Title hidden>Search</Dialog.Title>
                <div className="flex items-center border-b border-gray-700 light:border-gray-300 pb-2 mb-3">
                    <input
                        className="flex-1 bg-transparent outline-none placeholder-gray-400 pl-5 pr-3"
                        type="text"
                        placeholder="Search chats..."
                        onInput={e => search(e.currentTarget.value)}
                        autoFocus
                    />
                    <Dialog.Close className="p-1 rounded-3xl hover:bg-gray-700">
                        <Cross1Icon className="size-4" />
                    </Dialog.Close>
                </div>

                <div className="max-h-[50vh] overflow-y-auto space-y-1">
                    {chats.length === 0 ? (
                        <p className="text-gray-400 light:text-gray-600 text-sm px-3 py-2">You have no chats to search.</p>
                    ) : (
                        <>
                            {results.length === 0 ? (
                                <p className="text-gray-400 light:text-gray-600 text-sm px-3 py-2">No chats found.</p>
                            ) : (
                                results.map(entry => (
                                    <a
                                        key={entry.uuid}
                                        className="block px-3 py-2 rounded hover:bg-gray-700 light:hover:bg-gray-300"
                                        href={`/chat/${entry.uuid}`}
                                    >
                                        {entry.title}
                                        {entry.matches.length > 0 && (
                                            <ul>
                                                {entry.matches.map((message: string, i: number) => (
                                                    <li key={i}>{message.slice(0, 100)}...</li>
                                                ))}
                                            </ul>
                                        )}
                                    </a>
                                ))
                            )}
                        </>
                    )}
                </div>
            </Dialog.Content>
        </Dialog.Root>
    )
}