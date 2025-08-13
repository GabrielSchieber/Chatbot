import { useRef, type ReactNode } from "react"
import "./IconButton.css"

interface IconButtonProps {
    onClick: () => void
    children: ReactNode
    animateSelector?: string
    buttonClass?: string
    disabled?: boolean
}

export default function IconButton({
    onClick,
    children,
    animateSelector,
    buttonClass = "",
    disabled = false
}: IconButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleClick = () => {
        onClick()

        if (buttonRef.current && animateSelector) {
            const element = buttonRef.current.querySelector<SVGElement>(animateSelector)
            if (element) {
                element.classList.remove("animate")
                void element.clientWidth
                element.classList.add("animate")
            }
        }
    }

    return (
        <button type="button" ref={buttonRef} className={`icon-button ${buttonClass}`} onClick={handleClick} disabled={disabled}>
            {children}
        </button>
    )
}