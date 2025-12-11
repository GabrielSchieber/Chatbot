import { ArchiveIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CopyIcon, Cross2Icon, GearIcon, MagnifyingGlassIcon, PauseIcon, Pencil1Icon, PlusIcon, TrashIcon, UpdateIcon } from "@radix-ui/react-icons"
import { t } from "i18next"
import { Dialog, DropdownMenu, Select, Tooltip } from "radix-ui"
import { useEffect, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react"
import { useParams } from "react-router"

import ConfirmDialog from "./ConfirmDialog"
import { UnarchiveIcon } from "./Icons"
import { useChat } from "../providers/ChatProvider"
import { useNotify } from "../providers/NotificationProvider"
import { archiveChat, deleteChat, regenerateMessage, stopPendingChats, unarchiveChat } from "../utils/api"
import type { Chat, Model } from "../utils/types"

export function AddFilesButton({ fileInputRef, tabIndex = 2 }: { fileInputRef: RefObject<HTMLInputElement | null>, tabIndex?: number }) {
    return (
        <TooltipButton
            trigger={<PlusIcon className="size-6" />}
            tooltip={t("addFilesButton.tooltip")}
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
        />
    )
}

export function SelectModelButton({ model, setModel, tabIndex = 2 }: { model: Model, setModel: Dispatch<SetStateAction<Model>>, tabIndex?: number }) {
    const { isMobile } = useChat()

    return (
        <Select.Root value={model} onValueChange={v => setModel(v as Model)}>
            <TooltipButton
                trigger={
                    <Select.Trigger
                        className="
                            flex w-27.5 px-1 items-center justify-between rounded-lg text-xs cursor-pointer outline-none
                            hover:bg-gray-700 light:hover:bg-gray-300
                            focus:bg-gray-700 light:focus:bg-gray-300
                        "
                        tabIndex={tabIndex}
                    >
                        <Select.Value />
                        <Select.Icon>
                            <ChevronDownIcon />
                        </Select.Icon>
                    </Select.Trigger>
                }
                tooltip={t("selectModelButton.tooltip")}
                type="button"
                asChild
            />

            <Select.Portal>
                <Select.Content
                    className={dropdownContentClassName + (!isMobile && " -translate-x-7.5")}
                    position="popper"
                    sideOffset={5}
                    onCloseAutoFocus={e => e.preventDefault()}
                >
                    <Select.Viewport>
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <Select.Item
                                key={m}
                                value={m}
                                className={dropdownItemClassName}
                            >
                                <Select.ItemText>{m}</Select.ItemText>
                                <Select.ItemIndicator>
                                    <CheckIcon className="size-5.5" />
                                </Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Select.Viewport>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

export function SendButton({ sendMessage, isDisabled, tabIndex = 2 }: { sendMessage: () => void, isDisabled: boolean, tabIndex?: number }) {
    return (
        <TooltipButton
            trigger={<ArrowUpIcon className="size-6" />}
            tooltip={t("sendButton.tooltip")}
            onClick={sendMessage}
            type="submit"
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
            tooltip={t("stopButton.tooltip")}
            onClick={() => {
                stopPendingChats()
                setChats(previous => previous.map(c => ({ ...c, pending_message_id: null })))
            }}
            type="button"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
            dataTestID="stop-button"
        />
    )
}

export function CancelButton({ setIndex, tabIndex = 2 }: { setIndex: React.Dispatch<React.SetStateAction<number>>, tabIndex?: number }) {
    return (
        <TooltipButton
            trigger={<Cross2Icon className="size-6" />}
            tooltip={t("cancelButton.tooltip")}
            onClick={() => setIndex(-1)}
            type="button"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
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
            tooltip={t("editButton.tooltip")}
            onClick={onClick}
            type="button"
            className={messageButtonClassNames}
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
            tooltip={t("copyButton.tooltip")}
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
                    alert(t("regenerateButton.alert.failed"))
                }
            })
        } else {
            alert(t("regenerateButton.alert.noChat"))
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
                        <DropdownMenu.Trigger
                            className={messageButtonClassNames}
                            disabled={currentChat?.is_archived || pendingChat !== undefined || isLoading}
                            data-testid="regenerate"
                        >
                            <UpdateIcon className={`size-4.5 ${isRotating && "animate-spin"}`} />
                        </DropdownMenu.Trigger>
                    </Tooltip.Trigger>

                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="flex flex-col px-2 py-1 items-center text-sm text-white rounded-xl bg-black"
                            side="bottom"
                            sideOffset={3}
                        >
                            <p>{t("regenerateButton.tooltip")}</p>
                            {model && <p className="text-xs text-gray-400">{t("regenerateButton.tooltipUsedModel", { model })}</p>}
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className={dropdownContentClassName} sideOffset={5} data-testid="regenerate-dropdown">
                        {(["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"] as Model[]).map(m => (
                            <DropdownMenu.Item
                                key={m}
                                className={dropdownItemClassName}
                                onSelect={_ => regenerate(m)}
                                data-testid="regenerate-dropdown-entry"
                            >
                                {m}
                                {m === model && <CheckIcon className="size-5.5" />}
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
            <Pencil1Icon className="size-4.5" /> {t("renameButton.label")}
        </DropdownMenu.Item>
    )
}

export function ArchiveButton({ chat }: { chat: Chat }) {
    const { setChats } = useChat()
    const notify = useNotify()

    async function handleArchiveChat() {
        const response = await archiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, is_archived: true } : c))
        } else {
            notify(t("archiveButton.error", { title: chat.title }))
        }
    }

    return (
        <DropdownMenu.Item className={nonDestructiveChatDropdownItemClassName} onSelect={handleArchiveChat}>
            <ArchiveIcon className="size-4.5" /> {t("archiveButton.label")}
        </DropdownMenu.Item>
    )
}

export function UnarchiveButton({ chat }: { chat: Chat }) {
    const { setChats } = useChat()
    const notify = useNotify()

    async function handleUnarchiveChat() {
        const response = await unarchiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, is_archived: false } : c))
        } else {
            notify(t("unarchiveButton.error", { title: chat.title }))
        }
    }

    return (
        <DropdownMenu.Item className={nonDestructiveChatDropdownItemClassName} onSelect={handleUnarchiveChat}>
            <UnarchiveIcon className="size-4.5" /> {t("unarchiveButton.label")}
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
            notify(t("deleteButton.error", { title: chat.title }))
        }
    }

    return (
        <ConfirmDialog
            trigger={
                <DropdownMenu.Item className={destructiveChatDropdownItemClassName} onSelect={e => e.preventDefault()}>
                    <TrashIcon className="size-4.5" /> {t("deleteButton.label")}
                </DropdownMenu.Item>
            }
            title={t("deleteButton.title")}
            description={t("deleteButton.description", { title: chat.title })}
            confirmText={t("deleteButton.confirm")}
            cancelText={t("deleteButton.cancel")}
            onConfirm={() => handleDelete(chat)}
        />
    )
}

export function TooltipButton({ trigger, tooltip, onClick, type, className, isDisabled, tabIndex, asChild, dataTestID, tooltipSize = "sm" }: {
    trigger: ReactNode
    tooltip: ReactNode
    onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
    type?: "button" | "submit" | "reset"
    className?: string
    isDisabled?: boolean
    tabIndex?: number
    asChild?: boolean
    dataTestID?: string
    tooltipSize?: string
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Tooltip.Provider delayDuration={0}>
            <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
                <Tooltip.Trigger onClick={onClick} type={type} className={className} disabled={isDisabled} tabIndex={tabIndex} asChild={asChild} data-testid={dataTestID}>
                    {trigger}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className={`mx-1 px-2 py-1 text-${tooltipSize} text-white rounded-lg bg-black`}
                        side="bottom"
                        sideOffset={3}
                        onMouseEnter={_ => setIsOpen(false)}
                    >
                        {tooltip}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    )
}

export function ToggleSidebar({ withLabel, onClick }: { withLabel: boolean, onClick: VoidFunction }) {
    return (
        <button className={sidebarButtonClasses} onClick={onClick}>
            {withLabel ? (
                <><ChevronLeftIcon className="size-5" />{t("sidebar.closeSidebar")}</>
            ) : (
                <ChevronRightIcon className="size-5" />
            )}
        </button>
    )
}

export function NewChat({ withLabel }: { withLabel: boolean }) {
    return (
        <a className={sidebarButtonClasses} href="/">
            <PlusIcon className="size-5" /> {withLabel && t("sidebar.newChat")}
        </a>
    )
}

export function SearchChats({ withLabel }: { withLabel: boolean }) {
    return (
        <Dialog.Trigger className={sidebarButtonClasses}>
            <MagnifyingGlassIcon className="size-5" /> {withLabel && t("sidebar.searchChats")}
        </Dialog.Trigger>
    )
}

export function OpenSettings({ withLabel }: { withLabel: boolean }) {
    return (
        <Dialog.Trigger className={sidebarButtonClasses}>
            <GearIcon className="size-5" /> {withLabel && t("sidebar.settings")}
        </Dialog.Trigger>
    )
}

const messageButtonClassNames = `
    p-2 rounded-lg cursor-pointer outline-none
    hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300
    disabled:text-gray-500 disabled:cursor-not-allowed
`

const promptBarButtonClassNames = `
    p-1.5 rounded-full cursor-pointer outline-none
    hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300
    disabled:cursor-not-allowed disabled:text-gray-500
`

const dropdownContentClassName = `
    flex flex-col gap-2 mx-2 p-1 rounded-xl border
    text-white light:text-black
    border-gray-600 light:border-gray-400
    bg-gray-800 light:bg-gray-200
`

const dropdownItemClassName = `
    flex w-40 px-3 py-2 items-center justify-between rounded-xl cursor-pointer outline-none
    hover:bg-gray-700 light:hover:bg-gray-300
    not-hover-none:focus:bg-gray-700 not-hover-none:light:focus:bg-gray-300
`

const chatDropdownItemClassName = "flex gap-2 px-3 py-2 items-center text-center rounded-xl cursor-pointer outline-none"

const nonDestructiveChatDropdownItemClassName = `
    ${chatDropdownItemClassName}
    text-white light:text-black
    hover:bg-gray-600 light:hover:bg-gray-400/50
    focus:bg-gray-600 light:focus:bg-gray-400/50
`

const destructiveChatDropdownItemClassName = `
    ${chatDropdownItemClassName}
    text-red-500
    hover:bg-red-400/20
    focus:bg-red-400/20
`

const sidebarButtonClasses = "flex gap-1 p-2 items-center rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"