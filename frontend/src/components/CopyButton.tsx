import IconButton from "./IconButton"

export default function CopyButton({ buttonClass, onCopy }: { buttonClass: string, onCopy: () => void }) {
    return (
        <IconButton onClick={onCopy} animateSelector=".back-sheet" buttonClass={buttonClass}>
            <svg className="icon-button-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
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
        </IconButton>
    )
}