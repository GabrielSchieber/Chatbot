import { useCallback, useEffect, useRef, useState } from "react"
import type { Chat, SearchEntry } from "../../types"
import "./Search.css"
import { throttle } from "../../utils/throttle"
import { searchChats } from "../../utils/api"

interface SearchProps {
    chats: Chat[]
    isVisible: boolean
    results: SearchEntry[]
    setIsVisible: React.Dispatch<React.SetStateAction<boolean>>
    setResults: React.Dispatch<React.SetStateAction<SearchEntry[]>>
}

export default function Search({ chats, isVisible, results, setIsVisible, setResults }: SearchProps) {
    const ref = useRef<HTMLDivElement | null>(null)

    const [isHiding, setIsHiding] = useState(false)

    const [selectedIndex, setSelectedIndex] = useState<number>(-1)

    const moveSelectionDown = useCallback(
        throttle(() => {
            setSelectedIndex(previous => results.length > 0 ? Math.min(previous + 1, results.length - 1) : -1)
        }, 100),
        [results.length]
    )

    const moveSelectionUp = useCallback(
        throttle(() => {
            setSelectedIndex(previous => Math.max(previous - 1, 0))
        }, 100),
        []
    )

    function closeSearch() {
        setIsHiding(true)
        setTimeout(() => {
            setIsHiding(false)
            setIsVisible(false)
        }, 300)
    }

    useEffect(() => {
        if (!isVisible) return

        function closeSearchOnOutsideClick(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                closeSearch()
            }
        }

        document.addEventListener("mousedown", closeSearchOnOutsideClick)
        return () => document.removeEventListener("mousedown", closeSearchOnOutsideClick)
    }, [isVisible])

    useEffect(() => {
        if (!isVisible) return

        function closeSearchOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeSearch()
            }
        }

        document.addEventListener("keydown", closeSearchOnEscape)
        return () => document.removeEventListener("keydown", closeSearchOnEscape)
    }, [isVisible])

    useEffect(() => {
        if (!isVisible) return

        function handleKeyboardNavigation(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeSearch()
            } else if (event.key === "ArrowDown") {
                event.preventDefault()
                moveSelectionDown()
            } else if (event.key === "ArrowUp") {
                event.preventDefault()
                moveSelectionUp()
            } else if (event.key === "Enter" && selectedIndex >= 0 && selectedIndex < results.length) {
                const selected = results[selectedIndex]
                location.href = `/chat/${selected.uuid}`
            }
        }

        document.addEventListener("keydown", handleKeyboardNavigation)
        return () => document.removeEventListener("keydown", handleKeyboardNavigation)
    }, [isVisible, results, selectedIndex, moveSelectionDown, moveSelectionUp])

    useEffect(() => {
        if (selectedIndex < 0) return
        const entries = document.querySelectorAll(".search-entry-a")
        const selected = entries[selectedIndex] as HTMLElement | undefined
        selected?.scrollIntoView({ block: "nearest" })
    }, [selectedIndex])

    useEffect(() => {
        setSelectedIndex(results.length > 0 ? 0 : -1)
    }, [results])

    function search(event: React.FormEvent<HTMLInputElement>) {
        chats.length > 0 && searchChats(event.currentTarget.value).then(chats => chats && setResults(chats))
    }

    return (
        <>
            {isVisible && <div id="search-backdrop-div"></div>}
            {
                (isVisible || isHiding) && (
                    <div id="search-div" className={isHiding ? "fade-out" : "fade-in"} ref={ref}>
                        <div id="search-header-div">
                            <input id="search-input" placeholder="Search here..." onInput={search} />
                            <button id="search-close-button" onClick={closeSearch}>X</button>
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
        </>
    )
}