import { ArrowUpIcon, CheckIcon, CopyIcon, Pencil1Icon, PlusIcon, UpdateIcon } from "@radix-ui/react-icons"
import { DropdownMenu, Tooltip } from "radix-ui"
import { useState, type ReactNode } from "react"
import { useParams } from "react-router"

import { useChat } from "../../context/ChatProvider"
import { regenerateMessage } from "../../utils/api"
import type { Model } from "../../types"

export function AttachButton({ fileInputRef }: { fileInputRef: React.RefObject<HTMLInputElement | null> }) {
    return (
        <button
            className="p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300 transition"
            onClick={_ => fileInputRef.current?.click()}
        >
            <PlusIcon className="size-5" />
        </button>
    )
}

export function ModelButton({ icon, model, setModel }: {
    icon: React.ReactNode
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
}) {
    function Item({ m }: { m: Model }) {
        return (
            <DropdownMenu.Item
                className="w-40 p-2 rounded-md cursor-pointer hover:bg-gray-800/50 light:hover:bg-gray-200/50"
                onClick={() => setModel(m)}
            >
                <div className="flex gap-2 items-center justify-between">
                    {m}{m === model && <CheckIcon className="size-5" />}
                </div>
            </DropdownMenu.Item>
        )
    }

    const models: Model[] = ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className="p-1 rounded-md cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300 transition">
                {icon}
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-1 rounded-md bg-gray-700 light:bg-gray-300" sideOffset={4}>
                {models.map(m => (
                    <Item key={m} m={m} />
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}

export function SendButton({ sendMessage, isDisabled }: { sendMessage: () => void, isDisabled: boolean }) {
    return (
        <button
            className="
                p-1.5 rounded-full cursor-pointer bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500
                disabled:hover:bg-gray-600 disabled:cursor-not-allowed transition
            "
            onClick={sendMessage}
            disabled={isDisabled}
        >
            <ArrowUpIcon className="size-5" />
        </button>
    )
}

export function EditButton({ onClick }: { onClick: () => void }) {
    const { pendingChat, isLoading } = useChat()

    return (
        <TooltipButton
            trigger={<Pencil1Icon className="size-4.5" />}
            tooltip="Edit"
            onClick={onClick}
            isDisabled={pendingChat !== null || isLoading}
        />
    )
}

export function CopyButton({ text }: { text: string }) {
    const [isChecked, setIsChecked] = useState(false)

    return (
        <TooltipButton
            trigger={isChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
            tooltip="Copy"
            onClick={() => {
                navigator.clipboard.writeText(text)
                setIsChecked(true)
                setTimeout(() => setIsChecked(false), 2000)
            }}
        />
    )
}

export function RegenerateButton({ index, model }: { index: number, model?: Model }) {
    const { chatUUID } = useParams()

    const { setMessages, pendingChat, setPendingChat, isLoading } = useChat()

    function regenerate(model: Model) {
        if (chatUUID) {
            regenerateMessage(chatUUID, index, model).then(response => {
                if (response.ok) {
                    setMessages(previous => {
                        const previousMessages = [...previous]
                        previousMessages[index].text = ""
                        previousMessages[index].model = model
                        return previousMessages
                    })

                    response.json().then(chat => setPendingChat(chat))
                } else {
                    alert("Regeneration of message was not possible")
                }
            })
        } else {
            alert("You must be in a chat to regenerate a message")
        }
    }

    return (
        <Tooltip.Provider delayDuration={200}>
            <DropdownMenu.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <DropdownMenu.Trigger
                            className="p-2 rounded-lg cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={pendingChat !== null || isLoading}
                        >
                            <UpdateIcon className="size-4.5" />
                        </DropdownMenu.Trigger>
                    </Tooltip.Trigger>

                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-white text-sm bg-black px-2 py-1 rounded-xl"
                            side="bottom"
                            sideOffset={3}
                        >
                            <div className="flex flex-col items-center">
                                <p>Regenerate</p>
                                {model && <p className="text-xs text-gray-400">Used {model}</p>}
                            </div>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className="flex flex-col gap-1 p-2 rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200" sideOffset={5}>
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={`
                                        flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600
                                        light:hover:bg-gray-400/50 ${m === model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                                    `}
                                onSelect={_ => regenerate(m)}
                            >
                                {m}
                                {m === model && <CheckIcon className="size-5" />}
                            </DropdownMenu.Item>
                        ))}
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </Tooltip.Provider>
    )
}

function TooltipButton({ trigger, tooltip, onClick, isDisabled = false }: {
    trigger: ReactNode
    tooltip: ReactNode
    onClick: () => void
    isDisabled?: boolean
}) {
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger
                    className="p-2 rounded-lg cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onClick}
                    disabled={isDisabled}
                >
                    {trigger}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content className="text-white text-sm bg-black px-2 py-1 rounded-xl" side="bottom" sideOffset={3}>
                        {tooltip}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    )
}