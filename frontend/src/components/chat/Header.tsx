import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu } from "radix-ui"
import { useParams } from "react-router"

import { ArchiveButton, DeleteButton } from "../ui/Buttons"
import { useChat } from "../../context/ChatProvider"

export default function Header() {
    const { chatUUID } = useParams()

    const { chats } = useChat()

    const currentChat = chats.find(c => c.uuid === chatUUID)

    return (
        <header className="flex w-full p-3 items-center justify-between">
            <p className="text-2xl font-semibold">Chatbot</p>

            {currentChat &&
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                        className="
                            p-2 rounded-lg cursor-pointer outline-none hover:bg-gray-700/50
                            light:hover:bg-gray-300/50 focus:bg-gray-700/50 light:focus:bg-gray-300/50
                        "
                    >
                        <DotsVerticalIcon className="size-4.5" />
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                        <DropdownMenu.Content className="flex flex-col mr-2 p-2 rounded-xl shadow-xl/50 border border-gray-500/50 bg-gray-700 light:bg-gray-300">
                            <ArchiveButton chat={currentChat} />
                            <DeleteButton chat={currentChat} />
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            }
        </header>
    )
}