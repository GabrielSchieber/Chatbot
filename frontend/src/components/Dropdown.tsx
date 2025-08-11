export function PastChatDropdownDiv({ index, children }: { index: number, children: React.ReactNode }) {
    const button = document.querySelectorAll(".past-chat-dropdown-button")[index]
    const className = button && button.getBoundingClientRect().bottom < window.innerHeight - 100 ? "past-chat-dropdown-div" : "past-chat-dropdown-div open-upwards"
    return <div className={className}>{children}</div>
}
