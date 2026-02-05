import { ArchiveIcon, ArrowUpIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CopyIcon, Cross2Icon, GearIcon, MagnifyingGlassIcon, PauseIcon, Pencil1Icon, PlusIcon, TrashIcon, UpdateIcon } from "@radix-ui/react-icons"
import { Dialog, DropdownMenu, Select, Tooltip } from "radix-ui"
import { useEffect, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router"

import ConfirmDialog from "./ConfirmDialog"
import { UnarchiveIcon } from "./Icons"
import { useChat } from "../../providers/ChatProvider"
import { useNotify } from "../../providers/NotificationProvider"
import { archiveChat, deleteChat, regenerateMessage, renameChat, unarchiveChat } from "../../utils/api"
import type { Chat, Model } from "../../utils/types"

export function AddFilesButton({ fileInputRef, tabIndex }: { fileInputRef: RefObject<HTMLInputElement | null>, tabIndex: number }) {
    const { t } = useTranslation()

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

export function SelectModelButton(
    { model, setModel, hasImages, isMobile, tabIndex }:
        { model: Model, setModel: Dispatch<SetStateAction<Model>>, hasImages: boolean, isMobile: boolean, tabIndex: number }
) {
    const { t } = useTranslation()

    return (
        <Select.Root value={model} onValueChange={v => setModel(v as Model)}>
            <TooltipButton
                trigger={
                    <Select.Trigger
                        className="
                            flex p-2 items-center justify-between rounded-lg text-xs cursor-pointer outline-none
                            hover:bg-zinc-700 light:hover:bg-zinc-300
                            focus:bg-zinc-700 light:focus:bg-zinc-300
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
                        {hasImages ? (
                            <TooltipButton
                                trigger={
                                    <Select.Item value="Gemma3:1B" className={dropdownItemClassName} disabled={true}>
                                        <Select.ItemText>Gemma3:1B</Select.ItemText>
                                        <Select.ItemIndicator>
                                            <CheckIcon className="size-5.5" />
                                        </Select.ItemIndicator>
                                    </Select.Item>
                                }
                                tooltip={t("selectModelButton.gemmaModelTooltip")}
                            />
                        ) : (
                            <Select.Item value="Gemma3:1B" className={dropdownItemClassName} disabled={hasImages}>
                                <Select.ItemText>Gemma3:1B</Select.ItemText>
                                <Select.ItemIndicator>
                                    <CheckIcon className="size-5.5" />
                                </Select.ItemIndicator>
                            </Select.Item>
                        )}

                        <Select.Item value="Qwen3-VL:4B" className={dropdownItemClassName}>
                            <Select.ItemText>Qwen3-VL:4B</Select.ItemText>
                            <Select.ItemIndicator>
                                <CheckIcon className="size-5.5" />
                            </Select.ItemIndicator>
                        </Select.Item>
                    </Select.Viewport>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

export function SendButton({ sendMessage, isDisabled, tabIndex }: { sendMessage: () => void, isDisabled: boolean, tabIndex: number }) {
    const { t } = useTranslation()

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

export function StopButton({ onClick, tabIndex }: { onClick: VoidFunction, tabIndex: number }) {
    const { t } = useTranslation()

    return (
        <TooltipButton
            trigger={<PauseIcon className="size-6" />}
            tooltip={t("stopButton.tooltip")}
            onClick={onClick}
            type="button"
            className={promptBarButtonClassNames}
            tabIndex={tabIndex}
            dataTestID="stop-button"
        />
    )
}

export function CancelButton({ setIndex, tabIndex }: { setIndex: React.Dispatch<React.SetStateAction<number>>, tabIndex: number }) {
    const { t } = useTranslation()

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
    const { t } = useTranslation()

    const { chatUUID } = useParams()

    const { chats } = useChat()

    const currentChat = chats.find(c => c.uuid === chatUUID)
    const pendingChat = chats.find(c => c.pending_message_id !== null)

    return (
        <TooltipButton
            trigger={<Pencil1Icon className="size-4.5" />}
            tooltip={t("editButton.tooltip")}
            onClick={onClick}
            type="button"
            className={messageButtonClassNames}
            isDisabled={currentChat?.is_archived || pendingChat !== undefined}
            dataTestID="edit"
        />
    )
}

export function CopyButton({ text }: { text: string }) {
    const { t } = useTranslation()

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
    const { t } = useTranslation()

    const { chats, setChats, setMessages } = useChat()
    const notify = useNotify()

    const [isRotating, setIsRotating] = useState(false)

    const currentChat = chats.find(c => c.uuid === chatUUID)
    const pendingChat = chats.find(c => c.pending_message_id !== null)

    async function regenerate(model: Model) {
        if (chatUUID) {
            const response = await regenerateMessage(chatUUID, index, model)
            if (response.ok) {
                setMessages(previous => {
                    const previousMessages = [...previous]
                    previousMessages[index].text = ""
                    previousMessages[index].model = model
                    return previousMessages
                })

                const chat = await response.json()
                setChats(previous => previous.map(c => c.uuid === chat.uuid ? chat : c))
                setIsRotating(true)
            } else if (response.status === 429) {
                notify(t("generation.throttled"), "error")
            } else {
                notify(t("regenerateButton.alert.failed"), "error")
            }
        } else {
            notify(t("regenerateButton.alert.noChat"), "error")
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
                            disabled={currentChat?.is_archived || pendingChat !== undefined}
                            data-testid="regenerate"
                        >
                            <UpdateIcon className={`size-4.5 ${isRotating && "animate-spin"}`} />
                        </DropdownMenu.Trigger>
                    </Tooltip.Trigger>

                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="flex flex-col px-2 py-1 items-center text-sm text-white rounded-xl bg-zinc-950"
                            side="bottom"
                            sideOffset={3}
                        >
                            <p>{t("regenerateButton.tooltip")}</p>
                            {model && <p className="text-xs text-zinc-400">{t("regenerateButton.tooltipUsedModel", { model })}</p>}
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content className={dropdownContentClassName} sideOffset={5} data-testid="regenerate-dropdown">
                        {(["Gemma3:1B", "Qwen3-VL:4B"] as Model[]).map(m => (
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
    const { t } = useTranslation()

    return (
        <DropdownMenu.Item className={nonDestructiveChatDropdownItemClassName} onSelect={onSelect}>
            <Pencil1Icon className="size-4.5" /> {t("renameButton.label")}
        </DropdownMenu.Item>
    )
}

export function ArchiveButton({ chat }: { chat: Chat }) {
    const { setChats } = useChat()
    const { t } = useTranslation()
    const notify = useNotify()

    async function handleArchiveChat() {
        const response = await archiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, is_archived: true } : c))
        } else if (response.status === 429) {
            notify(t("throttled"), "error")
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
    const { t } = useTranslation()
    const notify = useNotify()

    async function handleUnarchiveChat() {
        const response = await unarchiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, is_archived: false } : c))
        } else if (response.status === 429) {
            notify(t("throttled"), "error")
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
    const { t } = useTranslation()
    const notify = useNotify()

    async function handleDelete(chat: Chat) {
        const response = await deleteChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.filter(c => c.uuid !== chat.uuid))
            if (location.pathname.includes(chat.uuid)) {
                location.href = "/"
            }
        } else if (response.status === 429) {
            notify(t("throttled"), "error")
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
                        className={`mx-1 px-2 py-1 text-${tooltipSize} text-white rounded-lg bg-zinc-950`}
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
    const { t } = useTranslation()

    return (
        <button className={sidebarButtonClasses} onClick={onClick}>
            {withLabel ? (
                <><ChevronLeftIcon className="min-w-5 max-w-5 min-h-5 max-h-5" />{t("sidebar.closeSidebar")}</>
            ) : (
                <ChevronRightIcon className="min-w-5 max-w-5 min-h-5 max-h-5" />
            )}
        </button>
    )
}

export function NewChat({ withLabel }: { withLabel: boolean }) {
    const { t } = useTranslation()

    return (
        <a className={sidebarButtonClasses} href="/">
            <PlusIcon className="min-w-5 max-w-5 min-h-5 max-h-5" /> {withLabel && t("sidebar.newChat")}
        </a>
    )
}

export function TemporaryChat({ withLabel }: { withLabel: boolean }) {
    const { chatUUID } = useParams()
    const { t } = useTranslation()
    const { isTemporaryChat, setIsTemporaryChat } = useChat()

    return (
        <button
            className={`
                flex gap-1 items-center content-center rounded cursor-pointer
                ${withLabel ? "px-3 py-2" : "p-2"}
                ${chatUUID && "mx-auto"}
                ${isTemporaryChat ?
                    "bg-blue-800 light:bg-blue-200 hover:bg-blue-700 light:hover:bg-blue-300" : "hover:bg-zinc-700 light:hover:bg-zinc-300"
                }
                ${chatUUID && isTemporaryChat && "border-2 border-blue-500 disabled:cursor-not-allowed"}
            `}
            onClick={() => {
                if (chatUUID && isTemporaryChat) return
                setIsTemporaryChat(!isTemporaryChat)
            }}
            disabled={chatUUID !== undefined && isTemporaryChat}
        >
            <ClockIcon className="min-w-5 max-w-5 min-h-5 max-h-5" /> {withLabel && t("sidebar.temporaryChat")}
        </button>
    )
}

export function SearchChats({ withLabel }: { withLabel: boolean }) {
    const { t } = useTranslation()

    return (
        <Dialog.Trigger className={sidebarButtonClasses}>
            <MagnifyingGlassIcon className="min-w-5 max-w-5 min-h-5 max-h-5" /> {withLabel && t("sidebar.searchChats")}
        </Dialog.Trigger>
    )
}

export function OpenSettings({ withLabel }: { withLabel: boolean }) {
    const { t } = useTranslation()

    return (
        <Dialog.Trigger className={sidebarButtonClasses}>
            <GearIcon className="min-w-5 max-w-5 min-h-5 max-h-5" /> {withLabel && t("sidebar.settings")}
        </Dialog.Trigger>
    )
}

export function RenameDialog() {
    const { chatUUID } = useParams()
    const { t } = useTranslation()

    const { chats, setChats } = useChat()

    const currentChat = chats.find(c => c.uuid === chatUUID)

    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState(currentChat ? currentChat.title : "")

    useEffect(() => {
        if (open && currentChat) {
            setTitle(currentChat.title)
        }
    }, [open, currentChat])

    if (!currentChat) return <></>

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className={nonDestructiveChatDropdownItemClassName}>
                <Pencil1Icon className="size-4.5" /> {t("renameButton.label")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        z-10 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[90vw] max-w-md p-6 rounded-xl text-white light:text-black bg-zinc-800 light:bg-zinc-100
                    "
                    onCloseAutoFocus={e => e.preventDefault()}
                >
                    <form
                        className="flex flex-col gap-3"
                        onSubmit={e => {
                            e.preventDefault()
                            if (!title) return
                            renameChat(currentChat.uuid, title)
                            setChats(previous => previous.map(c => c.uuid === currentChat.uuid ? { ...c, title } : c))
                            setOpen(false)
                        }}
                    >
                        <Dialog.Title className="text-xl font-bold">{t("dialogs.renameChat.title")}</Dialog.Title>
                        <Dialog.Description hidden>{t("dialogs.renameChat.title")}</Dialog.Description>

                        <input
                            className="px-2 py-1 rounded-lg outline-none bg-zinc-700 light:bg-zinc-200"
                            placeholder={t("dialogs.renameChat.placeholder")}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />

                        <div className="flex gap-3 justify-end text-lg font-semibold">
                            <Dialog.Close
                                type="button"
                                className="
                                    px-4 py-2 rounded-xl cursor-pointer
                                    text-white light:text-black
                                    border border-zinc-500
                                    bg-zinc-700 light:bg-zinc-200
                                    hover:bg-zinc-700/50 light:hover:bg-zinc-200/50
                                "
                            >
                                {t("dialogs.renameChat.cancel")}
                            </Dialog.Close>
                            <button
                                type="submit"
                                className="
                                    px-4 py-2 rounded-xl cursor-pointer
                                    border border-zinc-500
                                    text-white light:text-black
                                    bg-zinc-900 light:bg-zinc-100
                                    hover:bg-zinc-900/50 light:hover:bg-zinc-100/50
                                "
                            >
                                {t("dialogs.renameChat.rename")}
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

const messageButtonClassNames = `
    p-2 rounded-lg cursor-pointer outline-none
    hover:bg-zinc-700 light:hover:bg-zinc-300
    focus:bg-zinc-700 light:focus:bg-zinc-300
    disabled:text-zinc-500 disabled:cursor-not-allowed
`

const promptBarButtonClassNames = `
    p-1.5 rounded-full cursor-pointer outline-none
    hover:bg-zinc-700 light:hover:bg-zinc-300
    focus:bg-zinc-700 light:focus:bg-zinc-300
    disabled:cursor-not-allowed disabled:text-zinc-500
`

const dropdownContentClassName = `
    flex flex-col gap-2 mx-2 p-1 rounded-xl border
    text-white light:text-black
    border-zinc-700 light:border-zinc-300
    bg-zinc-800 light:bg-zinc-100
`

const dropdownItemClassName = `
    flex w-37 px-3 py-2 items-center justify-between rounded-xl cursor-pointer outline-none
    hover:bg-zinc-700 light:hover:bg-zinc-300
    not-hover-none:focus:bg-zinc-700 not-hover-none:light:focus:bg-zinc-300
    data-[disabled]:text-zinc-500 data-[disabled]:cursor-not-allowed
`

const chatDropdownItemClassName = "flex gap-2 px-3 py-2 items-center text-center rounded-xl cursor-pointer outline-none"

const nonDestructiveChatDropdownItemClassName = `
    ${chatDropdownItemClassName}
    text-white light:text-black
    hover:bg-zinc-700/50 light:hover:bg-zinc-400/25
    focus:bg-zinc-700/50 light:focus:bg-zinc-400/25
`

const destructiveChatDropdownItemClassName = `
    ${chatDropdownItemClassName}
    text-red-500
    hover:bg-red-400/20
    focus:bg-red-400/20
`

const sidebarButtonClasses = "flex gap-1 p-2 items-center rounded cursor-pointer hover:bg-zinc-800 light:hover:bg-zinc-200"