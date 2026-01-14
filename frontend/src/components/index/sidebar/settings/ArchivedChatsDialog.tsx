import { Cross1Icon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { TooltipButton } from "../../../misc/Buttons"
import ConfirmDialog from "../../../misc/ConfirmDialog"
import { UnarchiveIcon } from "../../../misc/Icons"
import { useChat } from "../../../../providers/ChatProvider"
import { useNotify } from "../../../../providers/NotificationProvider"
import { archiveChats, deleteChat, getChats, unarchiveChat, unarchiveChats } from "../../../../utils/api"
import type { Chat } from "../../../../utils/types"

export function ArchivedChatsDialog({ triggerClassName }: { triggerClassName: string }) {
    const { t } = useTranslation()

    const { chats, setChats, isMobile } = useChat()
    const notify = useNotify()

    const entriesRef = useRef<HTMLDivElement | null>(null)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const isLoadingRef = useRef(false)

    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    async function loadEntries() {
        if (isLoadingRef.current || isLoading) return
        isLoadingRef.current = true
        setIsLoading(true)

        const offset = chats.filter(c => c.is_archived).length
        const limit = Math.round((window.innerHeight / 2) / 30)

        const response = await getChats(offset, limit, false, true)
        if (response.ok) {
            const data: { chats: Chat[], has_more: boolean } = await response.json()
            setChats(previous => Array.from(new Map([...previous, ...data.chats].map(c => [c.uuid, c])).values()))
            setHasMore(data.has_more)
        }

        setIsLoading(false)
        isLoadingRef.current = false
    }

    async function handleArchiveAll() {
        const response = await archiveChats()
        if (response.ok) {
            setChats(previous => previous.map(c => ({ ...c, is_archived: true })))
        } else {
            notify(t("archivedChats.error.archiveAll"), "error")
        }
    }

    async function handleUnarchiveAll() {
        const response = await unarchiveChats()
        if (response.ok) {
            setChats(previous => previous.map(c => ({ ...c, is_archived: false })))
        } else {
            notify(t("archivedChats.error.unarchiveAll"), "error")
        }
    }

    async function handleUnarchive(chat: Chat) {
        const response = await unarchiveChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? { ...c, is_archived: false } : c))
        } else {
            notify(t("archivedChats.error.unarchiveOne", { title: chat.title }), "error")
        }
    }

    async function handleDelete(chat: Chat) {
        const response = await deleteChat(chat.uuid)
        if (response.ok) {
            setChats(previous => previous.filter(c => c.uuid !== chat.uuid))
            if (location.pathname.includes(chat.uuid)) {
                location.href = "/"
            }
        } else {
            notify(t("archivedChats.error.deleteOne", { title: chat.title }), "error")
        }
    }

    useEffect(() => {
        if (!sentinelRef.current || !entriesRef.current) return

        const observer = new IntersectionObserver(
            async entries => {
                if (entries[0].isIntersecting) {
                    await loadEntries()
                }
            },
            {
                root: entriesRef.current,
                rootMargin: "10px"
            }
        )

        observer.observe(sentinelRef.current)
        return () => observer.disconnect()
    }, [hasMore, isLoading])

    return (
        <Dialog.Root onOpenChange={async open => open && await loadEntries()}>
            <Dialog.Trigger className={triggerClassName}>
                {t("archivedChats.button")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className={`
                        z-10 fixed flex flex-col left-1/2 -translate-x-1/2 text-white light:text-black bg-gray-800 light:bg-gray-200
                        ${isMobile ? "inset-0 size-full" : "w-[75%] max-w-200 max-h-[80vh] top-[10vh] rounded-xl"}
                    `}
                >
                    <div className="flex gap-3 p-3 items-center border-b">
                        <div className="flex flex-wrap w-full gap-3 items-center justify-center">
                            <Dialog.Title className="text-lg font-semibold">{t("archivedChats.title")}</Dialog.Title>
                            <Dialog.Description hidden>{t("archivedChats.description")}</Dialog.Description>
                            <div className="flex gap-3 items-center md:ml-auto">
                                <ArchiveOrUnarchiveDialog action="archive" onConfirm={handleArchiveAll} />
                                <ArchiveOrUnarchiveDialog action="unarchive" onConfirm={handleUnarchiveAll} />
                            </div>
                        </div>
                        <Dialog.Close className="ml-auto p-2 rounded-3xl cursor-pointer hover:bg-gray-700 light:hover:bg-gray-200" data-testid="close-settings">
                            <Cross1Icon className="size-5" />
                        </Dialog.Close>
                    </div>

                    <div ref={entriesRef} className="flex flex-col gap-1 px-2 py-4 items-center overflow-y-auto" data-testid="archived-chats">
                        {chats.filter(c => c.is_archived).map(c => (
                            <Entry key={c.uuid} chat={c} handleUnarchive={handleUnarchive} handleDelete={handleDelete} />
                        ))}

                        {isLoading && isLoadingRef.current ? (
                            <p className="text-gray-400 light:text-gray-600">{t("archivedChats.loading")}</p>
                        ) : chats.filter(c => c.is_archived).length === 0 ? (
                            <p className="text-gray-400 light:text-gray-600">{t("archivedChats.empty")}</p>
                        ) : hasMore && (
                            <div ref={sentinelRef} className="h-1"></div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function ArchiveOrUnarchiveDialog({ action, onConfirm }: { action: "archive" | "unarchive", onConfirm: () => void }) {
    const { t } = useTranslation()

    return (
        <ConfirmDialog
            trigger={
                <button className="px-3 py-1 rounded-3xl cursor-pointer bg-gray-700/50 hover:bg-gray-700 light:bg-gray-300/50 light:hover:bg-gray-300">
                    {action === "archive" ? t("archivedChats.archiveAll.confirm") : t("archivedChats.unarchiveAll.confirm")}
                </button>
            }
            title={action === "archive" ? t("archivedChats.archiveAll.title") : t("archivedChats.unarchiveAll.title")}
            description={action === "archive" ? t("archivedChats.archiveAll.description") : t("archivedChats.unarchiveAll.description")}
            confirmText={action === "archive" ? t("archivedChats.archiveAll.confirm") : t("archivedChats.unarchiveAll.confirm")}
            onConfirm={onConfirm}
            isDestructive={false}
        />
    )
}

function Entry({ chat, handleUnarchive, handleDelete }: { chat: Chat, handleUnarchive: (chat: Chat) => void, handleDelete: (chat: Chat) => void }) {
    const { t } = useTranslation()

    return (
        <a
            className="flex w-full px-2 py-1 items-center justify-between rounded-lg hover:bg-gray-700 light:hover:bg-gray-300"
            href={`/chat/${chat.uuid}`}
            data-testid="archived-chat-entry"
        >
            {chat.title}
            <div className="flex gap-1 items-center">
                <TooltipButton
                    trigger={<UnarchiveIcon className="size-4" />}
                    tooltip={t("archivedChats.tooltip.unarchive")}
                    className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-500/40"
                    onClick={e => {
                        e.preventDefault()
                        handleUnarchive(chat)
                    }}
                    tooltipSize="xs"
                />
                <TooltipButton
                    trigger={
                        <ConfirmDialog
                            trigger={<Cross1Icon className="size-4" />}
                            title={t("archivedChats.delete.title")}
                            description={t("archivedChats.delete.description", { title: chat.title })}
                            confirmText={t("archivedChats.delete.confirm")}
                            cancelText={t("archivedChats.delete.cancel")}
                            onConfirm={() => handleDelete(chat)}
                        />
                    }
                    onClick={e => e.preventDefault()}
                    tooltip={t("archivedChats.tooltip.delete")}
                    className="p-1.5 rounded-3xl text-red-500 cursor-pointer hover:bg-red-500/20"
                    tooltipSize="xs"
                />
            </div>
        </a>
    )
}