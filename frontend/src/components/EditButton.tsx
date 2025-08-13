import { useRef } from "react"
import "./EditButton.css"

interface EditButtonProps {
    onEdit: () => void
    buttonClass?: string
    ariaLabel?: string
}

export default function EditButton({ onEdit, buttonClass = "", ariaLabel = "Edit message" }: EditButtonProps) {
    const pencilRef = useRef<SVGPathElement>(null)

    const handleClick = () => {
        onEdit()

        if (pencilRef.current) {
            pencilRef.current.classList.remove("animate")
            void pencilRef.current.clientWidth
            pencilRef.current.classList.add("animate")
        }
    }

    return (
        <button
            type="button"
            className={`message-edit-button ${buttonClass}`}
            aria-label={ariaLabel}
            onClick={handleClick}
        >
            <svg
                className="message-edit-svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                focusable="false"
            >
                <path
                    ref={pencilRef}
                    d="M3 21v-3.75L14.81 5.44a1.5 1.5 0 0 1 2.12 0l2.63 2.63a1.5 1.5 0 0 1 0 2.12L7.75 21H3z"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M14.06 6.19l3.75 3.75"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    )
}