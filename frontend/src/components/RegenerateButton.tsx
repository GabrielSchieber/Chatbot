import IconButton from "./IconButton"

export default function RegenerateButton({ buttonClass, onRegenerate }: { buttonClass: string, onRegenerate: () => void }) {
    return (
        <IconButton onClick={onRegenerate} animateSelector=".regen-icon" buttonClass={buttonClass}>
            <svg className="icon-button-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                    className="regen-icon"
                    d="M4.93 4.93a10 10 0 0 1 14.14 0l1.41-1.41M21.48 4v5h-5 M19.07 19.07a10 10 0 0 1-14.14 0l-1.41 1.41M2.52 20v-5h5"
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