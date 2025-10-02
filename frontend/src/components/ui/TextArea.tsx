import React, { useEffect, useRef } from "react"

export default function TextArea({ text, setText, onKeyDown, placeholder = "Type your message here...", autoFocus = false }: {
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    placeholder?: string
    autoFocus?: boolean
}) {
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        const textArea = textAreaRef.current
        if (!textArea) return
        textArea.style.height = "auto"
        textArea.style.height = `${textArea.scrollHeight}px`
    }, [text])

    return (
        <div className="flex">
            <textarea
                ref={textAreaRef}
                className="flex-1 px-2 content-center resize-none outline-none"
                placeholder={placeholder}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
            />
        </div>
    )
}