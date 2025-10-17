import { motion } from "motion/react"
import { useEffect } from "react"

export default function TextArea({ ref, text, setText, sendMessageWithEvent, selectionStart, selectionEnd }: {
    ref: React.RefObject<HTMLTextAreaElement | null>
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    sendMessageWithEvent: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    selectionStart?: React.RefObject<number>
    selectionEnd?: React.RefObject<number>
}) {
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
                onChange={e => {
                    setText(e.target.value)
                    if (selectionStart) selectionStart.current = e.target.selectionStart
                    if (selectionEnd) selectionEnd.current = e.target.selectionEnd
                }}
                onKeyDown={sendMessageWithEvent}
                tabIndex={1}
                rows={1}
                autoFocus
            />
        </motion.div>
    )
}