import { ArrowUpIcon } from "@radix-ui/react-icons"

export default function Send({ sendMessage }: { sendMessage: () => void }) {
    return (
        <button className="bg-blue-700 hover:bg-blue-600 rounded-[25px] p-1.5 self-end cursor-pointer" tabIndex={3} onClick={sendMessage}>
            <ArrowUpIcon className="size-6 text-white" />
        </button>
    )
}