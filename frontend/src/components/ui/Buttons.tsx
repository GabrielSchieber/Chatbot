import { ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, Cross2Icon, PauseIcon, Pencil1Icon, PlusIcon, UpdateIcon, UploadIcon } from "@radix-ui/react-icons"
import { DropdownMenu, Tooltip } from "radix-ui"
import { useEffect, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react"
import { useParams } from "react-router"

import { useChat } from "../../context/ChatProvider"
import { regenerateMessage, stopPendingChats } from "../../utils/api"
import type { Model } from "../../types"

export function PlusDropdown({ fileInputRef, model, setModel, tabIndex = 2 }: {
    fileInputRef: RefObject<HTMLInputElement | null>
    model: Model
    setModel: Dispatch<SetStateAction<Model>>
    tabIndex?: number
}) {
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

    const contentClassName = `
        flex flex-col gap-2 p-2 text-white light:text-black rounded-xl
        border border-gray-600 light:border-gray-400 bg-gray-800 light:bg-gray-200
    `
    const itemClassName = `
        flex gap-1 px-3 py-2 rounded-xl cursor-pointer outline-none
        focus:bg-gray-700 light:focus:bg-gray-300 hover:bg-gray-700 light:bg-gray-300
    `

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className={promptBarButtonClassNames} tabIndex={tabIndex}>
                <PlusIcon className="size-6" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content className={contentClassName}>
                    <DropdownMenu.Item className={itemClassName} onClick={_ => fileInputRef.current?.click()}>
                        <UploadIcon className="size-6" /> Add files
                    </DropdownMenu.Item>

                    <DropdownMenu.Sub open={isModelDropdownOpen}>
                        <DropdownMenu.SubTrigger
                            className={itemClassName}
                            onClick={_ => setIsModelDropdownOpen(!isModelDropdownOpen)}
                            onKeyDown={e => e.key === "Enter" && setIsModelDropdownOpen(!isModelDropdownOpen)}
                        >
                            <BoxModelIcon className="size-6" />
                            Select model
                            {isModelDropdownOpen ? (
                                <ChevronLeftIcon className="size-6" />
                            ) : (
                                <ChevronRightIcon className="size-6" />
                            )}
                        </DropdownMenu.SubTrigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.SubContent className={contentClassName + " -translate-y-15"} sideOffset={12}>
                                {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                                    <DropdownMenu.Item
                                        key={m} className={itemClassName + " w-45 justify-between"}
                                        onClick={e => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setModel(m)
                                        }}
                                    >
                                        {m}
                                        {m === model && <CheckIcon className="size-6" />}
                                    </DropdownMenu.Item>
                                ))}
                            </DropdownMenu.SubContent>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Sub>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}

export function SendButton({ sendMessage, isDisabled, tabIndex = 2 }: { sendMessage: () => void, isDisabled: boolean, tabIndex?: number }) {
    return (
        <TooltipButton
            trigger={<ArrowUpIcon className="size-6" />}
            tooltip="Send"
            onClick={sendMessage}
            className={promptBarButtonClassNames}
            isDisabled={isDisabled}
            tabIndex={tabIndex}
            dataTestID="send"
        />
    )
}

export function StopButton({ tabIndex = 2 }: { tabIndex?: number }) {
    const { setPendingChat } = useChat()

    return (
        <TooltipButton
            trigger={<PauseIcon className="size-6" />}
            tooltip="Stop"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
            onClick={() => {
                stopPendingChats()
                setPendingChat(null)
            }}
        />
    )
}

export function CancelButton({ setIndex, tabIndex = 2 }: { setIndex: React.Dispatch<React.SetStateAction<number>>, tabIndex?: number }) {
    return (
        <TooltipButton
            trigger={<Cross2Icon className="size-6" />}
            tooltip="Cancel"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
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
        <Tooltip.Provider delayDuration={0}>
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
                        className="
                            flex flex-col gap-1 p-2 rounded-xl text-white light:text-black shadow-xl/50
                            border-2 border-gray-900 light:border-gray-100 bg-gray-800 light:bg-gray-200
                        "
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

export function TooltipButton({ trigger, tooltip, onClick, className = "", isDisabled = false, sideOffset = 3, tabIndex, asChild = false, dataTestID }: {
    trigger: ReactNode
    tooltip: ReactNode
    className?: string
    onClick?: () => void
    isDisabled?: boolean
    sideOffset?: number
    tabIndex?: number
    asChild?: boolean
    dataTestID?: string
}) {
    return (
        <Tooltip.Provider delayDuration={0}>
            <Tooltip.Root>
                <Tooltip.Trigger className={className} tabIndex={tabIndex} onClick={onClick} disabled={isDisabled} asChild={asChild} data-testid={dataTestID}>
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
    p-1.5 rounded-full cursor-pointer outline-none hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 transition
`