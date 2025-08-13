import "./TooltipButton.css"

interface TooltipButtonProps {
    button: React.ReactNode
    tooltipText: string
}

export default function TooltipButton({ button, tooltipText }: TooltipButtonProps) {
    return (
        <div className="tooltip-div">
            {button}
            <div className="tooltip-inner-div">{tooltipText}</div>
        </div>
    )
}