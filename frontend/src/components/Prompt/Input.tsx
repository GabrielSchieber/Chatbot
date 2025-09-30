type InputProps = {
    ref: React.RefObject<HTMLTextAreaElement | null>
    prompt: string
    setPrompt: (prompt: string) => void
    sendMessage: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export default function Input({ ref, prompt, setPrompt, sendMessage }: InputProps) {
    return (
        <textarea
            className="flex-1 px-2 content-center overflow-y-hidden resize-none outline-none"
            value={prompt}
            placeholder="Ask me anything..."
            onChange={e => setPrompt(e.currentTarget.value)}
            onKeyDown={sendMessage}
            ref={ref}
            rows={1}
            tabIndex={1}
            autoFocus
        />
    )
}