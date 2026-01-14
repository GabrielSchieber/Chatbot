import { useEffect } from "react"
import { useTranslation } from "react-i18next"

export default function TextArea({ ref, text, setText, sendMessageWithEvent, selectionStart, selectionEnd, tabIndex }: {
    ref: React.RefObject<HTMLTextAreaElement | null>
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    sendMessageWithEvent: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    selectionStart: React.RefObject<number>
    selectionEnd: React.RefObject<number>
    tabIndex: number
}) {
    const { t } = useTranslation()

    useEffect(() => {
        if (!ref.current) return

        ref.current.style.height = "auto"
        ref.current.style.minHeight = "auto"
        ref.current.style.maxHeight = "auto"

        ref.current.style.height = ref.current.scrollHeight + "px"
        ref.current.style.minHeight = ref.current.scrollHeight + "px"
        ref.current.style.maxHeight = ref.current.scrollHeight + "px"
    }, [text])

    return (
        <textarea
            ref={ref}
            className="flex-1 p-2 overflow-hidden resize-none outline-none"
            value={text}
            placeholder={t("textarea.placeholder")}
            onChange={e => {
                setText(e.target.value)
                selectionStart.current = e.target.selectionStart
                selectionEnd.current = e.target.selectionEnd
            }}
            onKeyDown={sendMessageWithEvent}
            tabIndex={tabIndex}
            rows={1}
            autoFocus
        />
    )
}