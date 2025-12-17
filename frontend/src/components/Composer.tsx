import { motion } from "motion/react"
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from "react"

import Attachments from "./Attachments"
import { AddFilesButton, CancelButton, SelectModelButton, SendButton, StopButton } from "./Buttons"
import TextArea from "./TextArea"
import { useChat } from "../providers/ChatProvider"
import type { MessageFile, Model } from "../utils/types"

export default function Composer({
    text,
    setText,
    files,
    model,
    setModel,
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
    const { chats, isLoading, isMobile } = useChat()

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const selectionStart = useRef(0)
    const selectionEnd = useRef(0)

    const [isExtended, setIsExtended] = useState(false)
    const [isWidthSmall, setIsWidthSmall] = useState(window.innerWidth < 425)

    const pendingChat = chats.find(c => c.pending_message_id !== null)
    const isSendButtonDisabled = (text.trim() === "" && files.length === 0) || pendingChat !== undefined || isLoading

    useEffect(() => {
        if (isWidthSmall) return
        setIsExtended(isExtended ? text !== "" : text.split("\n").length > 1 || (textAreaRef.current?.clientHeight || 0) > 48)
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
        <motion.form
            layout={!window.matchMedia("(prefers-reduced-motion)").matches}
            transition={{ type: "tween", duration: 0.15 }}
            className={`
                flex flex-col max-h-[50vh] overflow-hidden rounded-4xl bg-gray-800 light:bg-gray-200
                ${files.length > 0 ? "gap-2 px-4" : "px-3"}
                ${files.length > 0 || isExtended ? "pt-3 pb-2" : "py-1"}
                ${withBorderAndShadow ? "mb-5 border-t-4 border-gray-600 light:border-gray-400 shadow-xl/50" : "mt-10 mb-5"}
                ${isMobile ? "w-full" : "w-[60vw]"}
            `}
            onSubmit={e => e.preventDefault()}
            onClick={e => {
                if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                    return
                }
                textAreaRef.current?.focus()
            }}
            aria-label={ariaLabel}
            role="form"
        >
            <input ref={fileInputRef} className="hidden" type="file" onChange={onChangeFile} tabIndex={-1} aria-hidden multiple />

            {isExtended ? (
                <>
                    <div className="flex flex-col gap-1 overflow-x-hidden overflow-y-auto">
                        <Files files={files} onRemoveFile={onRemoveFile} onRemoveAllFiles={onRemoveAllFiles} overflowYAuto={false} />
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
                        <AddFilesButton fileInputRef={fileInputRef} />

                        <div className="flex gap-1">
                            <SelectModelButton model={model} setModel={setModel} />
                            {setIndex && <CancelButton setIndex={setIndex!} tabIndex={tabIndex + 1} />}
                            {pendingChat !== undefined && pendingChat !== null ? (
                                <StopButton tabIndex={tabIndex + 1} />
                            ) : (
                                <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} tabIndex={tabIndex + 1} />
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <Files files={files} onRemoveFile={onRemoveFile} onRemoveAllFiles={onRemoveAllFiles} overflowYAuto={true} />
                    <div className="flex gap-1 items-center overflow-x-hidden overflow-y-auto">
                        <AddFilesButton fileInputRef={fileInputRef} />

                        <TextArea
                            ref={textAreaRef}
                            text={text}
                            setText={setText}
                            sendMessageWithEvent={sendMessageWithEvent}
                            selectionStart={selectionStart}
                            selectionEnd={selectionEnd}
                            tabIndex={tabIndex}
                        />

                        <SelectModelButton model={model} setModel={setModel} />
                        {setIndex && <CancelButton setIndex={setIndex} tabIndex={tabIndex + 1} />}
                        {pendingChat !== undefined && pendingChat !== null ? (
                            <StopButton tabIndex={tabIndex + 1} />
                        ) : (
                            <SendButton sendMessage={sendMessage} isDisabled={isSendButtonDisabled} tabIndex={tabIndex + 1} />
                        )}
                    </div>
                </>
            )}
        </motion.form>
    )
}

function Files({
    files,
    onRemoveFile,
    onRemoveAllFiles,
    overflowYAuto
}: {
    files: MessageFile[]
    onRemoveFile: (file: MessageFile) => void
    onRemoveAllFiles: () => void
    overflowYAuto: boolean
}) {
    return (
        <>
            {files.length > 0 && (
                <div
                    className={`
                        flex flex-wrap gap-2 p-2 rounded-xl border
                        bg-gray-700 light:bg-gray-300 border-gray-200 light:border-gray-800
                        ${overflowYAuto && "overflow-x-hidden overflow-y-auto"}
                    `}
                >
                    <Attachments files={files} onRemove={onRemoveFile} onRemoveAll={onRemoveAllFiles} />
                </div>
            )}
        </>
    )
}