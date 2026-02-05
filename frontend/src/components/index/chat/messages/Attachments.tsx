import { CheckIcon, CopyIcon, Cross1Icon, CrossCircledIcon, EyeOpenIcon, FileIcon } from "@radix-ui/react-icons"
import { Dialog, Tabs } from "radix-ui"
import React, { useEffect, useState, type ReactElement } from "react"
import { useTranslation } from "react-i18next"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

import { MAX_FILE_SIZE, MAX_FILES } from "../../Chat"
import { getFileSize, getFileTypeTranslationKey } from "../../../../utils/misc"
import type { MessageFile } from "../../../../utils/types"

export default function Attachments(
    { files, onRemove, onRemoveAll, tabIndex }:
        { files: MessageFile[], onRemove?: (file: MessageFile) => void, onRemoveAll?: () => void, tabIndex?: number }
) {
    const { t } = useTranslation()

    return (
        <div
            className="
                flex flex-1 gap-1 p-2 justify-between rounded-lg border
                border-zinc-700 light:border-zinc-300 bg-zinc-900 light:bg-zinc-100
            "
        >
            <div className="flex flex-col gap-1 items-start">
                {files.map(f => (
                    <Attachment key={f.id} file={f} onRemove={onRemove} tabIndex={tabIndex ? tabIndex + 1 : undefined} />
                ))}
                {files.length > 0 &&
                    <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-zinc-800 light:bg-zinc-200 border border-zinc-700 light:border-zinc-300">
                        <div
                            className="
                                flex gap-1 px-2 py-0.5 rounded-xl items-center truncate border
                                border-zinc-700 light:border-zinc-300 bg-zinc-900 light:bg-zinc-100
                            "
                        >
                            <span className="text-zinc-300 light:text-zinc-700">{t("attachments.label.files")}:</span>
                            <span className="font-medium">{files.length}/{MAX_FILES}</span>
                        </div>
                        <div
                            className="
                                flex flex-wrap gap-1 px-2 py-0.5 rounded-xl items-center truncate border
                                border-zinc-700 light:border-zinc-300 bg-zinc-900 light:bg-zinc-100
                            "
                        >
                            <span className="text-zinc-300 light:text-zinc-700">{t("attachments.label.size")}:</span>
                            <span className="font-medium">
                                {getFileSize(files.map(f => f.content_size).reduce((a, c) => a + c, 0))} / {getFileSize(MAX_FILE_SIZE)}
                            </span>
                        </div>
                    </div>
                }
            </div>

            {onRemoveAll && files.length > 0 &&
                <div>
                    <button
                        type="button"
                        className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/20 light:hover:bg-red-500/40"
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

    const [text, setText] = useState("")

    async function tryGetText() {
        if (!file.content) {
            setText("")
            return
        }
        try {
            decoder.decode(await file.content.arrayBuffer())
        } catch {
            setText("")
            return
        }

        setText(await file.content.slice(0, 200).text())
    }

    useEffect(() => { tryGetText() }, [file.content])

    return (
        <div className="flex px-2 py-1 gap-1 items-center rounded-xl border border-zinc-700 light:border-zinc-300 bg-zinc-800 light:bg-zinc-200">
            {file.content_type.includes("image") ? (
                <ImageIcon file={file} />
            ) : (
                text ? (
                    <div
                        className="
                            size-14 p-1 rounded-lg text-[5px] overflow-hidden outline-none resize-none select-none
                            border border-zinc-700 light:border-zinc-300 bg-zinc-950 light:bg-zinc-50
                        "
                    >
                        {text}
                    </div>
                ) : (
                    <FileIcon className="size-14 p-1 rounded-lg" />
                )
            )}
            <div
                className="
                    flex flex-col h-full px-1.5 items-center justify-center text-[11px] rounded-lg
                    border border-zinc-700 light:border-zinc-300 bg-zinc-900 light:bg-zinc-100
                "
            >
                {[
                    [t("attachments.label.type"), t(getFileTypeTranslationKey(file.name))],
                    [t("attachments.label.name"), file.name],
                    [t("attachments.label.size"), getFileSize(file.content_size)]
                ].map(([label, value], i) => (
                    <React.Fragment key={i}>
                        <div className="flex max-w-[120px] md:max-w-[240px] gap-1 items-center">
                            <span className="text-nowrap text-zinc-300 light:text-zinc-700">{label}:</span>
                            <span className="font-medium">{value}</span>
                        </div>
                        {i < 2 && <div className="w-full h-px bg-zinc-700 light:bg-zinc-300" />}
                    </React.Fragment>
                ))}
            </div>
            <div className={`flex flex-col ${onRemove ? "h-full justify-between" : ""}`}>
                {onRemove &&
                    <button
                        type="button"
                        className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/20 light:hover:bg-red-500/40"
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
    const isMarkdown = !src && file.name.endsWith(".md")

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
            <Dialog.Trigger type="button" className="p-1 rounded-3xl cursor-pointer hover:bg-zinc-700 light:hover:bg-zinc-300">
                <EyeOpenIcon className="size-3.5" />
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/60 backdrop-blur-sm" />

                <Dialog.Content
                    className="
                        z-10 fixed flex flex-col w-[80vw] not-md:w-[calc(100vw-32px)] h-[80vh]
                        top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 rounded-xl
                        bg-zinc-900 light:bg-zinc-100 text-white light:text-black
                        border border-zinc-800 light:border-zinc-200 shadow-2xl outline-none
                    "
                >
                    <div className="flex px-4 py-3 items-center justify-between border-b border-zinc-800 light:border-zinc-200">
                        <Dialog.Title className="font-semibold text-lg">{t("attachments.viewer.label")}</Dialog.Title>
                        <Dialog.Description hidden>{t("attachments.label.files")}</Dialog.Description>
                        <Dialog.Close className="p-1.5 rounded-full cursor-pointer hover:bg-zinc-800 light:hover:bg-zinc-100 transition-colors">
                            <Cross1Icon className="size-4" />
                        </Dialog.Close>
                    </div>

                    <Tabs.Root className="flex flex-col flex-1 min-h-0" defaultValue="view">
                        <div className="flex flex-wrap gap-2 px-4 py-2 justify-between items-center text-sm border-b border-zinc-800 light:border-zinc-200 bg-zinc-900/50 light:bg-zinc-50">
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start sm:items-center">
                                <div className="flex gap-2 items-center">
                                    <span className="text-zinc-400 light:text-zinc-500">{t("attachments.label.type")}:</span>
                                    <span className="font-medium">{t(getFileTypeTranslationKey(file.name))}</span>
                                </div>
                                <div className="hidden sm:block w-px h-4 bg-zinc-700 light:bg-zinc-300" />
                                <div className="flex gap-2 items-center">
                                    <span className="text-zinc-400 light:text-zinc-500">{t("attachments.label.name")}:</span>
                                    <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                                </div>
                                <div className="hidden sm:block w-px h-4 bg-zinc-700 light:bg-zinc-300" />
                                <div className="flex gap-2 items-center">
                                    <span className="text-zinc-400 light:text-zinc-500">{t("attachments.label.size")}:</span>
                                    <span className="font-medium">{getFileSize(file.content_size)}</span>
                                </div>
                            </div>

                            {isMarkdown && (
                                <Tabs.List className="flex p-1 rounded-lg bg-zinc-800 light:bg-zinc-100">
                                    <Tabs.Trigger
                                        value="view"
                                        className="
                                            px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all
                                            data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:shadow-sm
                                            light:data-[state=active]:bg-white light:data-[state=active]:text-black
                                            text-zinc-400 light:text-zinc-500 hover:text-zinc-200 light:hover:text-zinc-700
                                        "
                                    >
                                        {t("attachments.viewer.view")}
                                    </Tabs.Trigger>

                                    <Tabs.Trigger
                                        value="code"
                                        className="
                                            px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-all
                                            data-[state=active]:bg-zinc-700 data-[state=active]:text-white data-[state=active]:shadow-sm
                                            light:data-[state=active]:bg-white light:data-[state=active]:text-black
                                            text-zinc-400 light:text-zinc-500 hover:text-zinc-200 light:hover:text-zinc-700
                                        "
                                    >
                                        {t("attachments.viewer.code")}
                                    </Tabs.Trigger>
                                </Tabs.List>
                            )}
                        </div>

                        {!src && file.content && file.content.size > maxFileSizeLimit &&
                            <p className="flex gap-2 m-2 p-3 items-center rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-sm">
                                <CrossCircledIcon className="size-4" />
                                {t("attachments.viewer.fileTooLargeNotice")}
                            </p>
                        }

                        <div className="flex-1 overflow-hidden relative bg-black/20 light:bg-zinc-50">
                            {src ? (
                                <div className="size-full flex items-center justify-center p-4">
                                    <img className="max-w-full max-h-full object-contain drop-shadow-md" src={src} />
                                </div>
                            ) : (
                                <div className="size-full flex flex-col overflow-y-auto">
                                    {isMarkdown ? (
                                        <div className="flex-1 overflow-y-auto p-4">
                                            <Tabs.Content value="code" className="outline-none">
                                                <pre className="font-mono text-sm whitespace-pre-wrap break-words text-zinc-300 light:text-zinc-700">
                                                    {text}
                                                </pre>
                                            </Tabs.Content>

                                            <Tabs.Content value="view" className="prose dark:prose-invert max-w-none outline-none">
                                                <Markdown
                                                    children={text}
                                                    remarkPlugins={[remarkGfm]}
                                                    rehypePlugins={[rehypeHighlight]}
                                                    components={{
                                                        pre({ node, children, ...props }) {
                                                            function getCode(children: any) {
                                                                const isInline = !className
                                                                if (isInline) {
                                                                    return (
                                                                        <code className="hljs language-txt" {...children.props}>
                                                                            {children.props.children}
                                                                        </code>
                                                                    )
                                                                }
                                                                return children
                                                            }

                                                            const [copied, setCopied] = useState(false)

                                                            function copyCodeBlock(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
                                                                const codeBlock = e.currentTarget?.parentElement?.parentElement?.querySelector("pre")
                                                                navigator.clipboard.writeText(codeBlock?.textContent || "")
                                                                setCopied(true)
                                                                setTimeout(() => setCopied(false), 2000)
                                                            }

                                                            const childArray = React.Children.toArray(children)
                                                            const codeNode = childArray[0] as ReactElement<{ className?: string, children?: React.ReactNode }>

                                                            const className = codeNode?.props.className || ""
                                                            const languageMatch = /language-(\w+)/.exec(className)
                                                            const language = languageMatch ? languageMatch[1] : "code"

                                                            return (
                                                                <div className="rounded-lg overflow-hidden my-4 border border-zinc-700 light:border-zinc-300">
                                                                    <div className="flex px-3 py-2 items-center justify-between bg-zinc-800 light:bg-zinc-200 border-b border-zinc-700 light:border-zinc-300">
                                                                        <p className="text-xs font-mono text-zinc-400 light:text-zinc-600 m-0">{language}</p>
                                                                        <button
                                                                            className="
                                                                                flex items-center gap-1.5 px-2 py-1 text-xs font-medium cursor-pointer
                                                                                rounded hover:bg-zinc-700 light:hover:bg-zinc-300 transition-colors
                                                                                text-zinc-300 light:text-zinc-700
                                                                            "
                                                                            onClick={copyCodeBlock}
                                                                        >
                                                                            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                                                                            {copied ? t("copyButton.tooltip.clicked") : t("copyButton.tooltip")}
                                                                        </button>
                                                                    </div>
                                                                    <pre className="overflow-x-auto p-3 m-0 bg-zinc-950 light:bg-zinc-50 text-sm" {...props}>
                                                                        {getCode(children)}
                                                                    </pre>
                                                                </div>
                                                            )
                                                        }
                                                    }}
                                                />
                                            </Tabs.Content>
                                        </div>
                                    ) : (
                                        <div className="p-4">
                                            <pre className="font-mono text-sm whitespace-pre-wrap break-words text-zinc-300 light:text-zinc-700">
                                                {text}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Tabs.Root>
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
            <img className="size-14 object-cover rounded-lg border border-zinc-700 light:border-zinc-300" src={src} />
        ) : (
            <svg className="size-14 object-cover rounded-lg animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

const decoder = new TextDecoder("utf-8", { fatal: true })