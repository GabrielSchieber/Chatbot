import { useRef } from "react"
import "./CopyButton.css"

interface CopyButtonProps {
    onCopy: () => void
    buttonClass?: string
    ariaLabel?: string
}

export default function CopyButton({ onCopy, buttonClass = "", ariaLabel = "Copy message" }: CopyButtonProps) {
    const backSheetRef = useRef<SVGPathElement>(null)

    const handleClick = () => {
        onCopy()

        if (backSheetRef.current) {
            backSheetRef.current.classList.remove("animate")
            void backSheetRef.current.clientWidth
            backSheetRef.current.classList.add("animate")
        }
    }

    return (
        <button
            type="button"
            className={`message-copy-button ${buttonClass}`}
            aria-label={ariaLabel}
            onClick={handleClick}
        >
            <svg
                className="message-copy-svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                focusable="false"
            >
                <path
                    ref={backSheetRef}
                    className="back-sheet"
                    d="M5 15V5a2 2 0 0 1 2-2h10"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <rect
                    className="front-sheet"
                    x={9}
                    y={9}
                    width={11}
                    height={11}
                    rx={2}
                    ry={2}
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