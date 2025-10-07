import { motion } from "motion/react"
import type { RefObject } from "react"

import { PlusDropdown, SendButton } from "../ui/Buttons"
import TextArea from "../ui/TextArea"
import type { Model } from "../../types"

export default function Composer({
    fileInputRef,
    textAreaRef,
    selectionStart,
    selectionEnd,
    text,
    setText,
    isExtended,
    hasFiles,
    filesArea,
    onFileChange,
    model,
    setModel,
    sendMessage,
    sendMessageWithEvent,
    isSendDisabled
}: {
    fileInputRef: RefObject<HTMLInputElement | null>
    textAreaRef: RefObject<HTMLTextAreaElement | null>
    selectionStart: RefObject<number>
    selectionEnd: RefObject<number>
    text: string
    setText: React.Dispatch<React.SetStateAction<string>>
    isExtended: boolean
    hasFiles: boolean
    filesArea: React.ReactNode
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
    sendMessage: () => void
    sendMessageWithEvent: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void | (() => void)
    isSendDisabled: boolean
}) {
    return (
        <motion.div
            layout
            transition={{ layout: { duration: 0.1, ease: "easeInOut" } }}
            className={`
                    flex flex-col w-[60vw] mb-5 rounded-4xl bg-gray-800 light:bg-gray-200
                    shadow-xl/50 border-t-4 border-gray-600 light:border-gray-400 ${hasFiles ? "gap-2 px-4 pt-3 pb-1" : "px-3 py-1"}
                `}
            onClick={e => {
                if (e.target instanceof HTMLElement && (e.target.tagName === "BUTTON" || e.target.closest("button"))) {
                    return
                }
                textAreaRef.current?.focus()
            }}
        >
            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} multiple />

            <div className="flex flex-col max-h-100 gap-1 overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                {filesArea}
                {isExtended &&
                    <TextArea
                        ref={textAreaRef}
                        text={text}
                        setText={setText}
                        sendMessageWithEvent={sendMessageWithEvent as any}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                    />
                }
            </div>

            <div className="flex gap-2 items-center justify-between">
                <PlusDropdown fileInputRef={fileInputRef} model={model} setModel={setModel} />
                {!isExtended &&
                    <TextArea
                        ref={textAreaRef}
                        text={text}
                        setText={setText}
                        sendMessageWithEvent={sendMessageWithEvent as any}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                    />
                }
                <SendButton sendMessage={sendMessage} isDisabled={isSendDisabled} />
            </div>
        </motion.div>
    )
}