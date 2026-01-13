import { t } from "i18next"
import { useEffect, useState } from "react"
import { useParams } from "react-router"

import Composer from "../prompt/Composer"
import { MAX_FILE_SIZE, MAX_FILES } from "../../Chat"
import { useChat } from "../../../../providers/ChatProvider"
import { useNotify } from "../../../../providers/NotificationProvider"
import { editMessage, getMessageFileIDs } from "../../../../utils/api"
import { getFileSize } from "../../../../utils/misc"
import type { MessageFile, Model } from "../../../../utils/types"

export default function Editor({ index, setIndex }: { index: number, setIndex: React.Dispatch<React.SetStateAction<number>> }) {
    const { chatUUID } = useParams()

    const { setChats, messages, setMessages } = useChat()
    const notify = useNotify()

    const message = messages[index]

    const [text, setText] = useState(message.text)
    const [model, setModel] = useState<Model>(messages[index + 1].model || "Gemma3:1B")
    const [hasImages, setHasImages] = useState(false)

    const [addedFiles, setAddedFiles] = useState<File[]>([])
    const [removedFiles, setRemovedFiles] = useState<MessageFile[]>([])

    async function edit(index: number) {
        if (!chatUUID) return

        const response = await editMessage(chatUUID, text, index, model, addedFiles, removedFiles.map(f => f.id))
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
                            content: file.slice(),
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

            const chat = await response.json()
            setChats(previous => previous.map(c => c.uuid === chat.uuid ? chat : c))

            const fileIDsResponse = await getMessageFileIDs(chat.uuid)
            if (fileIDsResponse.ok) {
                const file_ids: number[][] = await fileIDsResponse.json()
                setMessages(previous => previous.map((m, i) => ({ ...m, files: m.files.map((f, j) => ({ ...f, id: file_ids[i][j] })) })))
            }
        } else if (response.status === 429) {
            notify(t("generation.throttled"), "error")
        } else {
            notify(t("editor.error.sendFailed"), "error")
        }
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return

        const newFiles = []
        for (const file of e.target.files) {
            if (!file.type.includes("image") && (await file.text()).includes("�")) {
                notify(t("prompt.file.error.invalidType", { removedFile: file.name }), "error")
            } else {
                newFiles.push(file)
            }
        }
        if (newFiles.length === 0) {
            e.target.value = ""
            return
        }

        if (getCurrentFiles().length + e.target.files.length > MAX_FILES) {
            notify(t("prompt.file.error.tooMany", { max: MAX_FILES }), "error")
            e.target.value = ""
            return
        }

        if (newFiles.some(f => f.size === 0)) {
            notify(t("prompt.file.error.empty"), "error")
            e.target.value = ""
            return
        }

        const visibleTotal = getCurrentFiles().map(f => f.content_size).reduce((a, b) => a + b, 0)
        const removedTotal = removedFiles.map(r => r.content_size).reduce((a, b) => a + b, 0)
        const newTotal = newFiles.map(f => f.size).reduce((a, b) => a + b, 0)
        const totalSize = visibleTotal - removedTotal + newTotal

        if (totalSize > MAX_FILE_SIZE) {
            notify(t("prompt.file.error.tooLarge", { limit: getFileSize(MAX_FILE_SIZE) }), "error")
            e.target.value = ""
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
            toAddUI.push({ id, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type })
        }

        if (toAddFiles.length > 0) {
            setAddedFiles(previous => [...previous, ...toAddFiles.map(([_, f]) => f)])
        }

        e.target.value = ""
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
        const added: MessageFile[] = addedFiles.map((f, i) => ({ id: highestFileID + i + 1, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type }))
        return [...current, ...added]
    }

    useEffect(() => {
        for (const file of addedFiles) {
            if (file.type.includes("image")) {
                setHasImages(true)
                setModel("Qwen3-VL:4B")
                return
            }
        }
        setHasImages(false)
    }, [addedFiles])

    return (
        <Composer
            text={text}
            setText={setText}
            files={getCurrentFiles()}
            model={model}
            setModel={setModel}
            hasImages={hasImages}
            withBorderAndShadow={false}
            tabIndex={8}
            ariaLabel="Edit message"
            onChangeFile={handleFileChange}
            onRemoveFile={removeFile}
            onRemoveAllFiles={removeFiles}
            sendMessage={() => edit(index)}
            sendMessageWithEvent={() => { }}
            setIndex={setIndex}
        />
    )
}