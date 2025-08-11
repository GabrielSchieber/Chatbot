export function ConfirmPopup({
    message,
    isHiding,
    ref,
    onConfirm,
    onCancel
}: {
    message: string,
    isHiding: boolean,
    ref: React.RefObject<HTMLDivElement | null>,
    onConfirm: () => void,
    onCancel?: () => void
}) {
    return (
        <div className="confirm-popup-backdrop-div">
            <div className={`confirm-popup-div ${isHiding ? "fade-out" : "fade-in"}`} ref={ref}>
                <p>{message}</p>
                <div className="confirm-popup-buttons-div">
                    {onCancel && <button className="confirm-popup-cancel-button" onClick={onCancel}>Cancel</button>}
                    <button className="confirm-popup-confirm-button" onClick={onConfirm}>Confirm</button>
                </div>
            </div>
        </div>
    )
}