import { Cross2Icon } from "@radix-ui/react-icons"

export default function Notification({ title, uuid, onClick }: { title: string, uuid: string, onClick: () => void }) {
    return (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gray-700 light:bg-gray-300 z-10">
            <div>
                A message is already being generated in <a className="underline" href={`/chat/${uuid}`}>{title}</a>
            </div>
            <button className="p-1 rounded-3xl cursor-pointer hover:bg-gray-800" onClick={onClick}>
                <Cross2Icon />
            </button>
        </div>
    )
}