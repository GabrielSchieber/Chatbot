import type { Chat, SearchEntry } from "../../types"

interface SearchProps {
    ref: React.RefObject<HTMLDivElement | null>
    isHiding: boolean
    chats: Chat[]
    results: SearchEntry[]
    selectedIndex: number
    close: () => void
    searchChats: (search: string) => void
}

export default function Search({ ref, isHiding, chats, results, selectedIndex, close, searchChats }: SearchProps) {
    return (
        <div id="search-div" className={isHiding ? "fade-out" : "fade-in"} ref={ref}>
            <div id="search-header-div">
                <input id="search-input" placeholder="Search here..." onInput={event => chats.length > 0 && searchChats(event.currentTarget.value)} />
                <button id="search-close-button" onClick={close}>X</button>
            </div>
            <div id="search-entries-div">
                {chats.length === 0 ? (
                    <p>You have no chats to search.</p>
                ) : (
                    <>{results.length === 0 ? (
                        <p>No chats found.</p>
                    ) : (
                        <>{results.map((entry, index) => (
                            <a key={entry.uuid} className={`search-entry-a ${index === selectedIndex ? "selected" : ""}`} href={`/chat/${entry.uuid}`}>
                                {entry.title}
                                {entry.matches?.length > 0 && (
                                    <ul>
                                        {entry.matches.map((message: string, i: number) => (
                                            <li key={i}>{message.slice(0, 100)}...</li>
                                        ))}
                                    </ul>
                                )}
                            </a>
                        ))}</>
                    )}</>
                )}
            </div>
        </div>
    )
}