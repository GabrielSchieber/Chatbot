import { motion } from "motion/react"
import type { ChangeEvent, Dispatch, KeyboardEvent, ReactNode, RefObject, SetStateAction } from "react"

import { CancelButton, PlusDropdown, SendButton, StopButton } from "../ui/Buttons"
import TextArea from "../ui/TextArea"
import type { Chat, Model } from "../../types"

export default function Composer({
    fileInputRef,
    textAreaRef,
    selectionStart,
    selectionEnd,
    text,
    setText,
    isExtended,
    hasFiles,
    withBorderAndShadow,
    filesArea,
    onFileChange,
    model,
    setModel,
    sendMessage,
    sendMessageWithEvent,
    isSendDisabled,
    setIndex,
    pendingChat,
    tabIndex = 1
}: {
    fileInputRef: RefObject<HTMLInputElement | null>
    textAreaRef: RefObject<HTMLTextAreaElement | null>
    selectionStart: RefObject<number>
    selectionEnd: RefObject<number>
    text: string
    setText: Dispatch<SetStateAction<string>>
    isExtended: boolean
    hasFiles: boolean
    withBorderAndShadow: boolean
    filesArea: ReactNode
    onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
    model: Model
    setModel: Dispatch<React.SetStateAction<Model>>
    sendMessage: () => void
    sendMessageWithEvent: (e: KeyboardEvent<HTMLTextAreaElement>) => void | (() => void)
    isSendDisabled: boolean
    setIndex?: Dispatch<SetStateAction<number>>
    pendingChat?: Chat | null
    tabIndex?: number
}) {
    return (
        <motion.div
            layout
            transition={{ layout: { duration: 0.1, ease: "easeInOut" } }}
            className={`
                flex flex-col w-[60vw] rounded-4xl bg-gray-800 light:bg-gray-200
                ${hasFiles ? "gap-2 px-4 pt-3 pb-1" : "px-3 py-1"}
                ${withBorderAndShadow ? "mb-5 border-t-4 border-gray-600 light:border-gray-400 shadow-xl/50" : "mt-10 mb-5"}
            `}
            onClick={e => {
                if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                    return
                }
                textAreaRef.current?.focus()
            }}
        >
            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} multiple />

            <div className="flex flex-col max-h-100 gap-1 overflow-x-hidden overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                {filesArea}
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
                        <SendButton sendMessage={sendMessage} isDisabled={isSendDisabled} tabIndex={tabIndex + 1} />
                    )}
                </div>
            </div>
        </motion.div>
    )
}