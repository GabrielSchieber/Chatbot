import { motion } from "motion/react"
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from "react"

import TextArea from "./TextArea"
import Attachments from "../messages/Attachments"
import { AddFilesButton, CancelButton, SelectModelButton, SendButton, StopButton } from "../../../misc/Buttons"
import { useChat } from "../../../../providers/ChatProvider"
import type { MessageFile, Model } from "../../../../utils/types"
import { stopPendingChats } from "../../../../utils/api"

export default function Composer({
    text,
    setText,
    files,
    model,
    setModel,
    hasImages,
    withBorderAndShadow,
    tabIndex,
    ariaLabel,
    onChangeFile,
    onRemoveFile,
    onRemoveAllFiles,
    sendMessage,
    sendMessageWithEvent,
    setIndex
}: {
    text: string
    setText: Dispatch<SetStateAction<string>>
    files: MessageFile[]
    model: Model
    setModel: Dispatch<React.SetStateAction<Model>>
    hasImages: boolean,
    withBorderAndShadow: boolean
    tabIndex: number
    ariaLabel: string
    onChangeFile: (e: ChangeEvent<HTMLInputElement>) => void
    onRemoveFile: (file: MessageFile) => void
    onRemoveAllFiles: () => void
    sendMessage: () => void
    sendMessageWithEvent: (e: KeyboardEvent<HTMLTextAreaElement>) => void | (() => void)
    setIndex?: Dispatch<SetStateAction<number>>
}) {
    const { chats, setChats, isMobile } = useChat()

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const selectionStart = useRef(0)
    const selectionEnd = useRef(0)

    const [isExtended, setIsExtended] = useState(isTextWrapping())
    const [isWidthSmall, setIsWidthSmall] = useState(window.innerWidth < 425)

    const pendingChat = chats.find(c => c.pending_message_id !== null)
    const isSendButtonDisabled = (text.trim() === "" && files.length === 0) || pendingChat !== undefined

    function onStopClick() {
        stopPendingChats()
        setChats(previous => previous.map(c => ({ ...c, pending_message_id: null })))
    }

    function isTextWrapping() {
        return text.split("\n").length > 1 || (textAreaRef.current?.clientHeight || 0) > 48
    }

    useEffect(() => {
        if (isWidthSmall) return
        setIsExtended(isExtended ? text !== "" : isTextWrapping())
    }, [text, textAreaRef.current?.clientHeight])

    useEffect(() => {
        textAreaRef.current?.setSelectionRange(selectionStart.current, selectionEnd.current)
        textAreaRef.current?.focus()
    }, [isExtended, textAreaRef.current, selectionStart.current, selectionEnd.current])

    useEffect(() => {
        setIsExtended(isWidthSmall)
    }, [isWidthSmall])

    useEffect(() => {
        const onResize = () => setIsWidthSmall(window.innerWidth < 425)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    return (
        <motion.div
            layout={!window.matchMedia("(prefers-reduced-motion)").matches}
            transition={{ type: "tween", duration: 0.15 }}
            className={`
                flex flex-col w-full max-h-[50vh] overflow-hidden rounded-3xl bg-zinc-800 light:bg-zinc-100
                ${files.length > 0 ? "gap-2 px-4" : "px-3"}
                ${files.length > 0 || isExtended ? "pt-3 pb-2" : "py-1"}
                ${withBorderAndShadow ? "mb-5 border border-zinc-700 light:border-zinc-300 shadow-lg" : "mt-10 mb-5"}
            `}
            onClick={e => {
                if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                    return
                }
                textAreaRef.current?.focus()
            }}
            aria-label={ariaLabel}
        >
            <input ref={fileInputRef} className="hidden" type="file" onChange={onChangeFile} tabIndex={-1} aria-hidden multiple />

            {isExtended ? (
                <>
                    <div className="flex flex-col gap-1 overflow-x-hidden overflow-y-auto">
                        <Files files={files} onRemoveFile={onRemoveFile} onRemoveAllFiles={onRemoveAllFiles} overflowYAuto={false} tabIndex={tabIndex + 5} />
                        <TextArea
                            ref={textAreaRef}
                            text={text}
                            setText={setText}
                            sendMessageWithEvent={sendMessageWithEvent}
                            selectionStart={selectionStart}
                            selectionEnd={selectionEnd}
                            tabIndex={tabIndex}
                        />
                    </div>

                    <div className="flex gap-1 items-center justify-between">
                        <AddFilesButton fileInputRef={fileInputRef} tabIndex={tabIndex + 1} />

                        <div className="flex gap-1">
                            <SelectModelButton model={model} setModel={setModel} hasImages={hasImages} isMobile={isMobile} tabIndex={tabIndex + 2} />
                            {setIndex && <CancelButton setIndex={setIndex!} tabIndex={tabIndex + 3} />}
                            {pendingChat !== undefined && pendingChat !== null ? (
                                <StopButton onClick={onStopClick} tabIndex={tabIndex + 4} />
                            ) : (
                                <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} tabIndex={tabIndex + 4} />
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <Files files={files} onRemoveFile={onRemoveFile} onRemoveAllFiles={onRemoveAllFiles} overflowYAuto={true} tabIndex={tabIndex + 5} />
                    <div className="flex min-h-fit gap-1 items-center overflow-x-hidden overflow-y-auto">
                        <AddFilesButton fileInputRef={fileInputRef} tabIndex={tabIndex + 1} />

                        <TextArea
                            ref={textAreaRef}
                            text={text}
                            setText={setText}
                            sendMessageWithEvent={sendMessageWithEvent}
                            selectionStart={selectionStart}
                            selectionEnd={selectionEnd}
                            tabIndex={tabIndex}
                        />

                        <SelectModelButton model={model} setModel={setModel} hasImages={hasImages} isMobile={isMobile} tabIndex={tabIndex + 2} />
                        {setIndex && <CancelButton setIndex={setIndex} tabIndex={tabIndex + 3} />}
                        {pendingChat !== undefined && pendingChat !== null ? (
                            <StopButton onClick={onStopClick} tabIndex={tabIndex + 4} />
                        ) : (
                            <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} tabIndex={tabIndex + 4} />
                        )}
                    </div>
                </>
            )}
        </motion.div>
    )
}

export function Files({
    files,
    onRemoveFile,
    onRemoveAllFiles,
    overflowYAuto,
    tabIndex
}: {
    files: MessageFile[]
    onRemoveFile: (file: MessageFile) => void
    onRemoveAllFiles: () => void
    overflowYAuto: boolean,
    tabIndex: number
}) {
    return (
        <>
            {files.length > 0 && (
                <div
                    className={`
                        flex flex-wrap gap-2 p-2 rounded-xl border
                        bg-zinc-700 light:bg-zinc-200 border-zinc-600 light:border-zinc-300
                        ${overflowYAuto && "overflow-x-hidden overflow-y-auto"}
                    `}
                >
                    <Attachments files={files} onRemove={onRemoveFile} onRemoveAll={onRemoveAllFiles} tabIndex={tabIndex} />
                </div>
            )}
        </>
    )
}