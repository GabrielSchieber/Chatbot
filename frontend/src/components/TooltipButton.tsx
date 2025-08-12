import "./TooltipButton.css"

interface TooltipButtonProps {
    label: string,
    tooltipText: string,
    onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export default function TooltipButton({ label, tooltipText, onClick }: TooltipButtonProps) {
    return (
        <div className="tooltip-div">
            <button className="tooltip-button" onClick={onClick}>{label}</button>
            <div className="tooltip-inner-div">{tooltipText}</div>
        </div>
    )
}