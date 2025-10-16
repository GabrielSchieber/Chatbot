import { ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CopyIcon, Cross2Icon, PauseIcon, Pencil1Icon, PlusIcon, UpdateIcon, UploadIcon } from "@radix-ui/react-icons"
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
                <TooltipButton trigger={<PlusIcon className="size-6" />} tooltip="Add files and more..." sideOffset={10} asChild />
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-2 rounded-lg translate-x-20 bg-gray-800 light:bg-gray-200" sideOffset={12}>
                <DropdownMenu.Item className={itemClassNames + " px-2.5 py-1.5 rounded-lg"} onClick={_ => fileInputRef.current?.click()}>
                    <UploadIcon className="size-5" /> Add files
                </DropdownMenu.Item>

                <DropdownMenu.Item>
                    <Select.Root value={model} onValueChange={v => setModel(v as Model)}>
                        <Select.Trigger
                            className={`
                                flex gap-2 w-50 px-2.5 py-1.5 items-center justify-between rounded-lg cursor-pointer outline-none
                                hover:bg-gray-700 focus:bg-gray-700 light:hover:bg-gray-300 light:focus:bg-gray-300 transition
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
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}

export function SendButton({ sendMessage, isDisabled }: { sendMessage: () => void, isDisabled: boolean }) {
    return (
        <TooltipButton
            trigger={<ArrowUpIcon className="size-6" />}
            tooltip="Send"
            onClick={sendMessage}
            className={promptBarButtonClassNames}
            isDisabled={isDisabled}
            dataTestID="send"
        />
    )
}

export function StopButton() {
    const { setPendingChat } = useChat()

    return (
        <TooltipButton
            trigger={<PauseIcon className="size-6" />}
            tooltip="Stop"
            className={promptBarButtonClassNames}
            onClick={() => {
                stopPendingChats()
                setPendingChat(null)
            }}
        />
    )
}

export function CancelButton({ setIndex }: { setIndex: React.Dispatch<React.SetStateAction<number>> }) {
    return (
        <TooltipButton
            trigger={<Cross2Icon className="size-6" />}
            tooltip="Cancel"
            className={promptBarButtonClassNames}
            onClick={() => setIndex(-1)}
            dataTestID="cancel"
        />
    )
}

export function EditButton({ onClick }: { onClick: () => void }) {
    const { pendingChat, isLoading } = useChat()

    return (
        <TooltipButton
            trigger={<Pencil1Icon className="size-4.5" />}
            tooltip="Edit"
            className={messageButtonClassNames}
            onClick={onClick}
            isDisabled={pendingChat !== null || isLoading}
            dataTestID="edit"
        />
    )
}

export function CopyButton({ text }: { text: string }) {
    const [isChecked, setIsChecked] = useState(false)

    return (
        <TooltipButton
            trigger={isChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
            tooltip="Copy"
            className={messageButtonClassNames}
            onClick={() => {
                navigator.clipboard.writeText(text)
                setIsChecked(true)
                setTimeout(() => setIsChecked(false), 2000)
            }}
            dataTestID="copy"
        />
    )
}

export function RegenerateButton({ index, model }: { index: number, model: Model | null }) {
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
                            data-testid="regenerate"
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
                    <DropdownMenu.Content
                        className="flex flex-col gap-1 p-2 rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200"
                        sideOffset={5}
                        data-testid="regenerate-dropdown"
                    >
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={`
                                    flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer outline-none
                                    focus:bg-gray-600 light:focus:bg-gray-400 hover:bg-gray-600 light:hover:bg-gray-400
                                    ${m === model ? "bg-gray-700 light:bg-gray-300" : "bg-gray-700/50 light:bg-gray-300/50"}
                                `}
                                onSelect={_ => regenerate(m)}
                                data-testid="regenerate-dropdown-entry"
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

export function TooltipButton({ trigger, tooltip, onClick, className = "", isDisabled = false, sideOffset = 3, asChild = false, dataTestID }: {
    trigger: ReactNode
    tooltip: ReactNode
    className?: string
    onClick?: () => void
    isDisabled?: boolean
    sideOffset?: number
    asChild?: boolean
    dataTestID?: string
}) {
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger className={className} onClick={onClick} disabled={isDisabled} asChild={asChild} data-testid={dataTestID}>
                    {trigger}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content className="px-2 py-1 rounded-lg text-white text-sm bg-black" side="bottom" sideOffset={sideOffset}>
                        {tooltip}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    )
}

const messageButtonClassNames = `
    p-2 rounded-lg cursor-pointer hover:bg-gray-700
    light:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed
`

const promptBarButtonClassNames = `
    p-1.5 rounded-full cursor-pointer disabled:cursor-not-allowed
    hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 transition
`