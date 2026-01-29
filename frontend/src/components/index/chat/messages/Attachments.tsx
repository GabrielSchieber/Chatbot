import { Cross1Icon, CrossCircledIcon, EyeOpenIcon, FileIcon } from "@radix-ui/react-icons"
import { Dialog } from "radix-ui"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { MAX_FILE_SIZE, MAX_FILES } from "../../Chat"
import { getFileSize, getFileTypeTranslationKey } from "../../../../utils/misc"
import type { MessageFile } from "../../../../utils/types"

export default function Attachments(
    { files, onRemove, onRemoveAll, tabIndex }:
        { files: MessageFile[], onRemove?: (file: MessageFile) => void, onRemoveAll?: () => void, tabIndex?: number }
) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-1 gap-1 justify-between">
            <div className="flex flex-col gap-1 items-start">
                {files.map(f => (
                    <Attachment key={f.id} file={f} onRemove={onRemove} tabIndex={tabIndex ? tabIndex + 1 : undefined} />
                ))}
                {files.length > 0 &&
                    <div className="flex gap-1 text-sm">
                        <p className="px-2.5 py-1 rounded-lg bg-gray-800 light:bg-gray-200">
                            {t("attachments.label.files")}: {files.length}/{MAX_FILES}
                        </p>
                        <p className="px-2.5 py-1 rounded-lg bg-gray-800 light:bg-gray-200">
                            {t("attachments.label.size")}: {getFileSize(files.map(f => f.content_size).reduce((a, c) => a + c, 0))}/{getFileSize(MAX_FILE_SIZE)}
                        </p>
                    </div>
                }
            </div>

            {onRemoveAll && files.length > 0 &&
                <div>
                    <button
                        type="button"
                        className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40"
                        onClick={onRemoveAll}
                        tabIndex={tabIndex}
                        data-testid="remove-all-attachments-button"
                    >
                        <Cross1Icon className="size-3.5" />
                    </button>
                </div>
            }
        </div>
    )
}

function Attachment({ file, onRemove, tabIndex }: { file: MessageFile, onRemove?: (file: MessageFile) => void, tabIndex?: number }) {
    const { t } = useTranslation()

    return (
        <div className="flex px-2 py-1 gap-1 items-center rounded-md bg-gray-800 light:bg-gray-200">
            {file.content_type.includes("image") ? (
                <ImageIcon file={file} />
            ) : (
                <FileIcon className="size-14 p-1 rounded-md bg-gray-700 light:bg-gray-300" />
            )}
            <div className="flex flex-col px-2 py-1 text-xs rounded-md bg-gray-700 light:bg-gray-300">
                {t("attachments.label.type")}: {t(getFileTypeTranslationKey(file.name))}<br />
                {t("attachments.label.name")}: {file.name}<br />
                {t("attachments.label.size")}: {getFileSize(file.content_size)}
            </div>
            <div className="flex flex-col">
                {onRemove &&
                    <button
                        type="button"
                        className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40"
                        onClick={() => onRemove(file)}
                        tabIndex={tabIndex}
                        data-testid={`remove-attachment-button-${file.name}`}
                    >
                        <Cross1Icon className="size-3.5" />
                    </button>
                }
                <AttachmentViewer file={file} />
            </div>
        </div>
    )
}

function AttachmentViewer({ file }: { file: MessageFile }) {
    const { t } = useTranslation()

    const [text, setText] = useState("")
    const [src, setSrc] = useState(() =>
        file.content && file.content_type.includes("image") ? URL.createObjectURL(file.content) : ""
    )

    const maxFileSizeLimit = 100_000

    useEffect(() => {
        if (!file.content) {
            setText("")
            setSrc("")
            return
        }

        if (file.content_type.includes("image")) {
            const objectUrl = URL.createObjectURL(file.content)
            setSrc(objectUrl)
            return () => URL.revokeObjectURL(objectUrl)
        } else {
            file.content.slice(0, maxFileSizeLimit).text().then(text => setText(text))
        }
    }, [file.content])

    return (
        <Dialog.Root>
            <Dialog.Trigger type="button" className="p-1 rounded-3xl cursor-pointer hover:bg-gray-500/40">
                <EyeOpenIcon className="size-3.5" />
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/50" />

                <Dialog.Title hidden>{t("attachments.viwer.label")}</Dialog.Title>
                <Dialog.Description hidden>{t("attachments.label.files")}</Dialog.Description>

                <Dialog.Content
                    className="
                        z-10 fixed flex flex-col w-[75vw] not-md:w-[calc(100vw-20px)] h-[75vh]
                        gap-2 p-2 rounded-lg top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2
                        border border-gray-500 text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <div className="flex gap-1 px-3 py-1 items-center justify-between rounded-lg bg-gray-900 light:bg-gray-100">
                        <p>{t("attachments.label.type")}: {t(getFileTypeTranslationKey(file.name))}</p>
                        <p>{t("attachments.label.name")}: {file.name}</p>
                        <p>{t("attachments.label.size")}: {getFileSize(file.content_size)}</p>
                        <Dialog.Close className="p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon className="size-5" />
                        </Dialog.Close>
                    </div>
                    {src ? (
                        <div className="relative size-full">
                            <img className="absolute size-full object-contain" src={src} />
                        </div>
                    ) : (
                        <>
                            {file.content && file.content.size > maxFileSizeLimit &&
                                <p className="flex gap-2 px-2 items-center rounded-lg bg-red-400/10 light:bg-red-600/10">
                                    <CrossCircledIcon className="text-red-400 light:text-red-600" />
                                    {t("attachments.viewer.fileTooLargeNotice")}
                                </p>
                            }
                            <div className="p-2 wrap-anywhere whitespace-pre-wrap overflow-y-auto rounded-lg bg-gray-900 light:bg-gray-100">
                                {text}
                            </div>
                        </>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function ImageIcon({ file }: { file: MessageFile }) {
    const [src, setSrc] = useState<string | null>(() => file.content ? URL.createObjectURL(file.content) : null)

    useEffect(() => {
        if (!file.content) {
            setSrc(null)
            return
        }
        const objectUrl = URL.createObjectURL(file.content)
        setSrc(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
    }, [file.content])

    return (
        src ? (
            <img className="size-14 object-cover rounded-md" src={src} />
        ) : (
            <svg className="size-14 object-cover rounded-md animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
        )
    )
}