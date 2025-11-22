import { motion } from "motion/react"
import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from "react"

import Attachments from "./Attachments"
import { CancelButton, PlusDropdown, SendButton, StopButton } from "./Buttons"
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

    const pendingChat = chats.find(c => c.pending_message_id !== null)

    useEffect(() => {
        setIsExtended(isExtended ? text !== "" : text.split("\n").length > 1 || (textAreaRef.current?.clientHeight || 0) > 48)
    }, [text])

    useEffect(() => {
        textAreaRef.current?.setSelectionRange(selectionStart.current, selectionEnd.current)
        textAreaRef.current?.focus()
    }, [isExtended])

    return (
        <motion.form
            layout
            className={`
                flex flex-col max-h-[50vh] rounded-4xl bg-gray-800 light:bg-gray-200
                ${files.length > 0 ? "gap-2 px-4 pt-3 pb-1" : "px-3 py-1"}
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

            <div className="flex flex-col gap-1 overflow-x-hidden overflow-y-auto">
                {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 rounded-xl border bg-gray-700 light:bg-gray-300 border-gray-200 light:border-gray-800">
                        <Attachments files={files} onRemove={onRemoveFile} onRemoveAll={onRemoveAllFiles} />
                    </div>
                )}

                {isExtended &&
                    <TextArea
                        ref={textAreaRef}
                        text={text}
                        setText={setText}
                        sendMessageWithEvent={sendMessageWithEvent as any}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                        tabIndex={tabIndex}
                    />
                }
            </div>

            <div className={`flex gap-2 items-center justify-between ${isExtended && "pb-1"}`}>
                <PlusDropdown fileInputRef={fileInputRef} model={model} setModel={setModel} tabIndex={tabIndex + 1} />
                {!isExtended &&
                    <TextArea
                        ref={textAreaRef}
                        text={text}
                        setText={setText}
                        sendMessageWithEvent={sendMessageWithEvent as any}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                        tabIndex={tabIndex}
                    />
                }
                <div className="flex gap-1">
                    {setIndex && <CancelButton setIndex={setIndex} tabIndex={tabIndex + 1} />}
                    {pendingChat !== undefined && pendingChat !== null ? (
                        <StopButton tabIndex={tabIndex + 1} />
                    ) : (
                        <SendButton
                            sendMessage={sendMessage}
                            isDisabled={(text.trim() === "" && files.length === 0) || pendingChat !== undefined || isLoading}
                            tabIndex={tabIndex + 1}
                        />
                    )}
                </div>
            </div>
        </motion.form>
    )
}