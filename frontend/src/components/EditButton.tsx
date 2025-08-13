import IconButton from "./IconButton"

export default function EditButton({ buttonClass, onEdit }: { buttonClass: string, onEdit: () => void }) {
    return (
        <IconButton onClick={onEdit} animateSelector=".pencil" buttonClass={buttonClass}>
            <svg className="icon-button-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                    className="pencil"
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
        </IconButton>
    )
}