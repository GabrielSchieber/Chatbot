import { ArchiveIcon, ArrowUpIcon, BoxModelIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, Cross2Icon, PauseIcon, Pencil1Icon, PlusIcon, TrashIcon, UpdateIcon, UploadIcon } from "@radix-ui/react-icons"
import { DropdownMenu, Tooltip } from "radix-ui"
import { useEffect, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react"
import { useParams } from "react-router"

import ConfirmDialog from "./ConfirmDialog"
import { useChat } from "../../context/ChatProvider"
import { useNotify } from "../../context/NotificationProvider"
import { archiveChat, deleteChat, regenerateMessage, stopPendingChats } from "../../utils/api"
import type { Chat, Model } from "../../types"

export function PlusDropdown({ fileInputRef, model, setModel, tabIndex = 2 }: {
    fileInputRef: RefObject<HTMLInputElement | null>
    model: Model
    setModel: Dispatch<SetStateAction<Model>>
    tabIndex?: number
}) {
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

    return (
        <DropdownMenu.Root>
            <TooltipButton
                trigger={
                    <DropdownMenu.Trigger className={promptBarButtonClassNames} tabIndex={tabIndex}>
                        <PlusIcon className="size-6" />
                    </DropdownMenu.Trigger>
                }
                tooltip="Add files and more..."
                asChild
            />

            <DropdownMenu.Portal>
                <DropdownMenu.Content className={dropdownContentClassName}>
                    <DropdownMenu.Item className={dropdownItemClassName} onClick={_ => fileInputRef.current?.click()}>
                        <UploadIcon className="size-6" /> Add files
                    </DropdownMenu.Item>

                    <DropdownMenu.Sub open={isModelDropdownOpen}>
                        <DropdownMenu.SubTrigger
                            className={dropdownItemClassName}
                            onClick={e => {
                                e.stopPropagation()
                                setIsModelDropdownOpen(!isModelDropdownOpen)
                            }}
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
                            <DropdownMenu.SubContent className={dropdownContentClassName + " -translate-y-15"} sideOffset={12} onClick={e => e.stopPropagation()}>
                                {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                                    <DropdownMenu.Item
                                        key={m}
                                        className={dropdownItemClassName + " w-45 justify-between"}
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
    const { setChats } = useChat()

    return (
        <TooltipButton
            trigger={<PauseIcon className="size-6" />}
            tooltip="Stop"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
            onClick={() => {
                stopPendingChats()
                setChats(previous => previous.map(c => ({ ...c, pending_message_id: null })))
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
    const { chatUUID } = useParams()

    const { chats, isLoading } = useChat()

    const currentChat = chats.find(c => c.uuid === chatUUID)
    const pendingChat = chats.find(c => c.pending_message_id !== null)

    return (
        <TooltipButton
            trigger={<Pencil1Icon className="size-4.5" />}
            tooltip="Edit"
            className={messageButtonClassNames}
            onClick={onClick}
            isDisabled={currentChat?.is_archived || pendingChat !== undefined || isLoading}
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

    const { chats, setChats, setMessages, isLoading } = useChat()

    const [isRotating, setIsRotating] = useState(false)

    const currentChat = chats.find(c => c.uuid === chatUUID)
    const pendingChat = chats.find(c => c.pending_message_id !== null)

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
                        setChats(previous => previous.map(c => c.uuid === chat.uuid ? chat : c))
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
        if (!pendingChat) {
            setIsRotating(false)
        }
    }, [pendingChat])

    return (
        <Tooltip.Provider delayDuration={0}>
            <DropdownMenu.Root>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <DropdownMenu.Trigger className={messageButtonClassNames} disabled={currentChat?.is_archived || pendingChat !== undefined || isLoading} data-testid="regenerate">
                            <UpdateIcon className={`size-4.5 ${isRotating && "animate-spin"}`} />
                        </DropdownMenu.Trigger>
                    </Tooltip.Trigger>

                    <Tooltip.Portal>
                        <Tooltip.Content className="flex flex-col px-2 py-1 items-center text-sm text-white rounded-xl bg-black" side="bottom" sideOffset={3}>
                            <p>Regenerate</p>
                            {model && <p className="text-xs text-gray-400">Used {model}</p>}
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className={dropdownContentClassName} sideOffset={5} data-testid="regenerate-dropdown">
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={dropdownItemClassName + " w-45 justify-between"}
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

export function RenameButton({ onSelect }: { onSelect: () => void }) {
    return (
        <DropdownMenu.Item className={nonDestructiveChatDropdownItemClassName} onSelect={onSelect}>
            <Pencil1Icon className="size-4.5" /> Rename
        </DropdownMenu.Item>
    )
}

export function ArchiveButton({ chat }: { chat: Chat }) {
    const { setChats } = useChat()
    const notify = useNotify()

    async function handleArchiveChat(chat: Chat) {
        const response = await archiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, is_archived: true } : c))
        } else {
            notify(`Archival of "${chat.title}" was not possible.`)
        }
    }

    return (
        <DropdownMenu.Item className={nonDestructiveChatDropdownItemClassName} onSelect={_ => handleArchiveChat(chat)}>
            <ArchiveIcon className="size-4.5" /> Archive
        </DropdownMenu.Item>
    )
}

export function DeleteButton({ chat }: { chat: Chat }) {
    const { setChats } = useChat()
    const notify = useNotify()

    async function handleDelete(chat: Chat) {
        const response = await deleteChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.filter(c => c.uuid !== chat.uuid))
            if (location.pathname.includes(chat.uuid)) {
                location.href = "/"
            }
        } else {
            notify(`Deletion of "${chat.title}" was not possible.`)
        }
    }

    return (
        <ConfirmDialog
            trigger={
                <DropdownMenu.Item className={destructiveChatDropdownItemClassName} onSelect={e => e.preventDefault()}>
                    <TrashIcon className="size-4.5" /> Delete
                </DropdownMenu.Item>
            }
            title="Delete Chat"
            description={`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            onConfirm={() => handleDelete(chat)}
        />
    )
}

export function TooltipButton({ trigger, tooltip, onClick, className = "", isDisabled = false, sideOffset = 3, tabIndex, asChild = false, tooltipSize = "sm", dataTestID }: {
    trigger: ReactNode
    tooltip: ReactNode
    className?: string
    onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
    isDisabled?: boolean
    sideOffset?: number
    tabIndex?: number
    asChild?: boolean
    tooltipSize?: string
    dataTestID?: string
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Tooltip.Provider delayDuration={0}>
            <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
                <Tooltip.Trigger className={className} tabIndex={tabIndex} onClick={onClick} disabled={isDisabled} asChild={asChild} data-testid={dataTestID}>
                    {trigger}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className={`px-2 py-1 text-${tooltipSize} text-white rounded-lg bg-black`}
                        side="bottom"
                        sideOffset={sideOffset}
                        onMouseEnter={_ => setIsOpen(false)}
                    >
                        {tooltip}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    )
}

const messageButtonClassNames = `
    p-2 rounded-lg cursor-pointer hover:bg-gray-700
    light:hover:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed
`

const promptBarButtonClassNames = `
    p-1.5 rounded-full cursor-pointer outline-none hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 transition
`

const dropdownContentClassName = `
    flex flex-col gap-2 p-2 text-white light:text-black rounded-xl
    border border-gray-600 light:border-gray-400 bg-gray-800 light:bg-gray-200
`

const dropdownItemClassName = `
    flex gap-1 px-3 py-2 rounded-xl cursor-pointer outline-none
    focus:bg-gray-700 light:focus:bg-gray-300 hover:bg-gray-700 light:bg-gray-300
`

const chatDropdownItemClassName = "flex gap-2 px-3 py-2 items-center rounded-xl cursor-pointer outline-none text-center"
const nonDestructiveChatDropdownItemClassName = chatDropdownItemClassName + " text-white light:text-black hover:bg-gray-600 light:hover:bg-gray-400/50"
const destructiveChatDropdownItemClassName = chatDropdownItemClassName + " text-red-500 hover:bg-red-400/20"