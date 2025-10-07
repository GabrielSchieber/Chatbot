import { ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CopyIcon, PauseIcon, Pencil1Icon, PlusIcon, UpdateIcon, UploadIcon } from "@radix-ui/react-icons"
import { DropdownMenu, Select, Tooltip } from "radix-ui"
import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { useParams } from "react-router"

import { useChat } from "../../context/ChatProvider"
import { regenerateMessage, stopPendingChats } from "../../utils/api"
import type { Model } from "../../types"

export function PlusDropdown({ fileInputRef, model, setModel }: {
    fileInputRef: RefObject<HTMLInputElement | null>
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
}) {
    const itemClassNames = `
        flex gap-2 items-center cursor-pointer outline-none hover:bg-gray-700
        focus:bg-gray-700 light:hover:bg-gray-300 light:focus:bg-gray-300 transition
    `

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className={itemClassNames + " p-1.5 rounded-full"}>
                <PlusIcon className="size-6" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-2 rounded-lg translate-x-20 bg-gray-800 light:bg-gray-200" sideOffset={12}>
                <DropdownMenu.Item className={itemClassNames + " px-2.5 py-1.5 rounded-lg"} onClick={_ => fileInputRef.current?.click()}>
                    <UploadIcon className="size-5" /> Add files
                </DropdownMenu.Item>

                <ModelSelect model={model} setModel={setModel} />
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}

export function ModelSelect({ model, setModel }: { model: Model, setModel: React.Dispatch<React.SetStateAction<Model>> }) {
    return (
        <Select.Root value={model} onValueChange={v => setModel(v as Model)}>
            <Select.Trigger
                className={`
                    flex gap-2 w-50 px-2.5 py-1.5 items-center justify-between rounded-lg cursor-pointer outline-none hover:bg-gray-700
                    focus:bg-gray-700 light:hover:bg-gray-300 light:focus:bg-gray-300 transition
                `}
            >
                <div className="flex gap-2 items-center">
                    <Select.Icon>
                        <BoxModelIcon className="size-5" />
                    </Select.Icon>
                    <Select.Value placeholder="Select model..." />
                </div>
                <Select.Icon>
                    <ChevronRightIcon className="size-4.5" />
                </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
                <Select.Content position="popper" side="right" sideOffset={10} className="-translate-y-17">
                    <Select.ScrollUpButton>
                        <ChevronUpIcon />
                    </Select.ScrollUpButton>

                    <Select.Viewport className="flex flex-col gap-1 p-2 rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200">
                        {[(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <Select.Item
                                key={m}
                                value={m}
                                className={`
                                    flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer outline-none
                                    focus:bg-gray-600 light:focus:bg-gray-400 hover:bg-gray-600 light:hover:bg-gray-400
                                    ${m === model ? "bg-gray-700 light:bg-gray-300" : "bg-gray-700/50 light:bg-gray-300/50"}
                                `}
                            >
                                <Select.ItemText>{m}</Select.ItemText>
                                <Select.ItemIndicator className="ml-auto">
                                    <CheckIcon className="size-5" />
                                </Select.ItemIndicator>
                            </Select.Item>
                        ))]}
                    </Select.Viewport>

                    <Select.ScrollDownButton>
                        <ChevronDownIcon />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

export function SendButton({ sendMessage, isDisabled }: { sendMessage: () => void, isDisabled: boolean }) {
    return <Button icon={<ArrowUpIcon className="size-6" />} onClick={sendMessage} isDisabled={isDisabled} />
}

export function StopButton() {
    const { setPendingChat } = useChat()

    return (
        <Button
            icon={<PauseIcon className="size-6" />}
            onClick={() => {
                stopPendingChats()
                setPendingChat(null)
            }}
        />
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

    const [isRotating, setIsRotating] = useState(false)

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

                    response.json().then(chat => {
                        setPendingChat(chat)
                        setIsRotating(true)
                    })
                } else {
                    alert("Regeneration of message was not possible")
                }
            })
        } else {
            alert("You must be in a chat to regenerate a message")
        }
    }

    useEffect(() => {
        if (pendingChat === null) {
            setIsRotating(false)
        }
    }, [pendingChat])

    return (
        <Tooltip.Provider delayDuration={200}>
            <DropdownMenu.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <DropdownMenu.Trigger
                            className="p-2 rounded-lg cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={pendingChat !== null || isLoading}
                        >
                            <UpdateIcon className={`size-4.5 ${isRotating && "animate-spin"}`} />
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
                                    flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer outline-none
                                    focus:bg-gray-600 light:focus:bg-gray-400 hover:bg-gray-600 light:hover:bg-gray-400
                                    ${m === model ? "bg-gray-700 light:bg-gray-300" : "bg-gray-700/50 light:bg-gray-300/50"}
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

export function Button({ icon, onClick, isDisabled = false }: { icon: ReactNode, onClick: () => void, isDisabled?: boolean }) {
    return (
        <button
            className="
                p-1.5 rounded-full cursor-pointer disabled:cursor-not-allowed
                hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 transition
            "
            onClick={onClick}
            disabled={isDisabled}
        >
            {icon}
        </button>)
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