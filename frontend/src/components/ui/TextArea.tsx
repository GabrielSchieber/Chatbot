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
                className="flex-1 resize-none overflow-hidden rounded-xl border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={text}
                placeholder="Ask me anything..."
                onChange={e => {
                    setText(e.target.value)
                    if (selectionStart) selectionStart.current = e.target.selectionStart
                    if (selectionEnd) selectionEnd.current = e.target.selectionEnd
                }}
                onKeyDown={sendMessageWithEvent}
                rows={1}
            />
        </motion.div>
    )
}