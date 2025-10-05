import { motion } from "motion/react"
import { useEffect, useRef } from "react"

export default function TextArea({ text, setText, sendMessageWithEvent }: {
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    sendMessageWithEvent: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
    const ref = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        if (ref.current) {
            ref.current.style.height = "auto"
            ref.current.style.height = ref.current.scrollHeight + "px"
        }
    }, [text])

    return (
        <motion.div className="flex flex-1">
            <motion.textarea
                ref={ref}
                className="flex-1 p-2 overflow-hidden resize-none outline-none"
                value={text}
                placeholder="Ask me anything..."
                onChange={e => setText(e.target.value)}
                onKeyDown={sendMessageWithEvent}
                rows={1}
                autoFocus
            />
        </motion.div>
    )
}