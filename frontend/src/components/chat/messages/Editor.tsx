import { BoxModelIcon, PlusIcon } from "@radix-ui/react-icons"
import { useRef, useState } from "react"
import { useParams } from "react-router"

import Attachments from "../../ui/Attachments"
import Button from "../../ui/Button"
import Dropdown from "../../ui/Dropdown"
import TextArea from "../../ui/TextArea"
import { MAX_FILE_SIZE, MAX_FILES } from "../../Chat"
import { useChat } from "../../../context/ChatProvider"
import { editMessage } from "../../../utils/api"
import { getFileSize } from "../../../utils/file"
import type { MessageFile, Model } from "../../../types"

export default function Editor({ index, setIndex }: { index: number, setIndex: React.Dispatch<React.SetStateAction<number>> }) {
    const { chatUUID } = useParams()

    const { messages, setMessages, pendingChat, setPendingChat } = useChat()

    const message = messages[index]

    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [text, setText] = useState(message.text)
    const [model, setModel] = useState<Model>(messages[index + 1].model || "SmolLM2-135M")

    const [addedFiles, setAddedFiles] = useState<File[]>([])
    const [removedFiles, setRemovedFiles] = useState<MessageFile[]>([])

    function edit(index: number) {
        if (chatUUID) {
            editMessage(chatUUID, text, index, model, addedFiles, removedFiles.map(f => f.id)).then(response => {
                if (response.ok) {
                    let shouldSetMessages = true
                    setMessages(previous => {
                        if (shouldSetMessages) {
                            const previousMessages = [...previous]

                            previousMessages[index].text = text

                            for (const removedFileID of removedFiles.map(f => f.id)) {
                                previousMessages[index].files = previousMessages[index].files.filter(file => file.id !== removedFileID)
                            }

                            let highestID = 1
                            for (const file of previousMessages[index].files) {
                                if (file.id > highestID) {
                                    highestID = file.id
                                }
                            }

                            previousMessages[index].files = [
                                ...previousMessages[index].files,
                                ...addedFiles.map((file, index) => ({
                                    id: highestID + index + 1,
                                    name: file.name,
                                    content_size: file.size,
                                    content_type: file.type
                                }))]

                            previousMessages[index + 1].text = ""

                            shouldSetMessages = false
                            return previousMessages
                        } else {
                            return previous
                        }
                    })

                    setIndex(-1)
                    setText("")
                    setAddedFiles([])
                    setRemovedFiles([])

                    response.json().then(chat => setPendingChat(chat))
                } else {
                    alert("Edition of message was not possible")
                }
            })
        } else {
            alert("You must be in a chat to edit a message")
        }
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files) return

        if (getCurrentFiles().length + event.target.files.length > MAX_FILES) {
            alert(`You can only attach up to ${MAX_FILES} files at a time.`)
            event.target.value = ""
            return
        }

        const newFiles = Array.from(event.target.files)

        const visibleTotal = getCurrentFiles().map(f => f.content_size).reduce((a, b) => a + b, 0)
        const removedTotal = removedFiles.map(r => r.content_size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)
        const totalSize = visibleTotal - removedTotal + newTotal

        if (totalSize > MAX_FILE_SIZE) {
            alert(`Total file size exceeds ${getFileSize(MAX_FILE_SIZE)} limit. Please select smaller files.`)
            event.target.value = ""
            return
        }

        const existingAddedKeys = new Set(addedFiles.map(f => f.name + "|" + f.size))
        const existingVisibleKeys = new Set(getCurrentFiles().map(f => f.name + "|" + f.content_size))

        const highestVisibleFileID = getCurrentFiles().map(f => f.id).sort((a, b) => a - b).at(-1) || 1

        let syntheticCounter = 0
        const toAddUI: MessageFile[] = []
        const toAddFiles: [number, File][] = []

        for (const f of newFiles) {
            const key = f.name + "|" + f.size

            if (existingAddedKeys.has(key) || existingVisibleKeys.has(key)) {
                continue
            }

            const removedIndex = removedFiles.findIndex(r => r.name === f.name && r.content_size === f.size)
            if (removedIndex !== -1) {
                const original = removedFiles[removedIndex]
                setRemovedFiles(prev => prev.filter((_, i) => i !== removedIndex))
                toAddUI.push(original)
                existingVisibleKeys.add(key)
                continue
            }

            syntheticCounter += 1
            const id = highestVisibleFileID + syntheticCounter

            toAddFiles.push([id, f])
            toAddUI.push({ id, name: f.name, content_size: f.size, content_type: f.type })
        }

        if (toAddFiles.length > 0) {
            setAddedFiles(prev => [...prev, ...toAddFiles.map(([_, f]) => f)])
        }

        event.target.value = ""
    }

    function removeFile(file: MessageFile) {
        const currentFile = getCurrentFiles().find(f => f.id === file.id && f.name === file.name && f.content_size === file.content_size)
        const addedFilesKeys = new Set(addedFiles.map(f => f.name + "|" + f.size))
        if (currentFile && !addedFilesKeys.has(currentFile.name + "|" + currentFile.content_size)) {
            setRemovedFiles(previous => previous.find(f => f.id === file.id) ? previous : [...previous, file])
        } else {
            setAddedFiles(previous => previous.filter(f => !(f.name === file.name && f.size === file.content_size)))
        }
    }

    function removeFiles() {
        setRemovedFiles(previous => {
            const existingIDs = new Set(previous.map(f => f.id))
            return [...previous, ...getCurrentFiles().filter(f => !existingIDs.has(f.id))]
        })
        setAddedFiles(previous => previous.filter(added => !getCurrentFiles().some(f => f.name === added.name && f.content_size === added.size)))
    }

    function getCurrentFiles() {
        const highestFileID = messages.flatMap(m => m.files).map(f => f.id).sort().at(-1) || 1
        const current = message.files.filter(f => !(new Set(removedFiles.map(f => f.id)).has(f.id)))
        const added: MessageFile[] = addedFiles.map((f, i) => ({ id: highestFileID + i + 1, name: f.name, content_size: f.size, content_type: f.type }))
        return [...current, ...added]
    }

    return (
        <div className="flex flex-col gap-1 w-[80%] max-h-100 px-3 py-2 rounded-2xl bg-gray-700 light:bg-gray-300">
            <div className="flex flex-col overflow-y-auto" style={{ scrollbarColor: "oklch(0.554 0.046 257.417) transparent" }}>
                {getCurrentFiles().length > 0 &&
                    <Attachments files={getCurrentFiles()} onRemove={removeFile} onRemoveAll={removeFiles} />
                }
                <TextArea text={text} setText={setText} />
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: "none" }}
                multiple
            />

            <div className="flex items-center justify-between">
                <div className="flex gap-1 items-center">
                    <Button icon={<PlusIcon className="size-6" />} onClick={() => fileInputRef.current?.click()} />
                    <Dropdown icon={<BoxModelIcon className="size-6" />} model={model} setModel={setModel} />
                </div>
                <div className="flex gap-1 items-center">
                    <button
                        className="
                            px-3 py-1 rounded-lg cursor-pointer bg-gray-800
                            hover:bg-gray-800/60 light:bg-gray-200 light:hover:bg-gray-200/60
                        "
                        onClick={_ => {
                            setIndex(-1)
                            setText("")
                            setAddedFiles([])
                            setRemovedFiles([])
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        className="
                            px-3 py-1 rounded-lg cursor-pointer text-black light:text-white bg-gray-100 hover:bg-gray-200
                            light:bg-gray-900 light:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
                        "
                        onClick={_ => edit(index)}
                        disabled={(text.trim() === "" && getCurrentFiles().length === 0) || pendingChat !== null}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}