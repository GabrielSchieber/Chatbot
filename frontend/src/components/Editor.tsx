import { useState } from "react"
import { useParams } from "react-router"

import Composer from "./Composer"
import { MAX_FILE_SIZE, MAX_FILES } from "./Chat"
import { useChat } from "../providers/ChatProvider"
import { editMessage } from "../utils/api"
import { getFileSize } from "../utils/misc"
import type { MessageFile, Model } from "../utils/types"

export default function Editor({ index, setIndex }: { index: number, setIndex: React.Dispatch<React.SetStateAction<number>> }) {
    const { chatUUID } = useParams()

    const { setChats, messages, setMessages } = useChat()

    const message = messages[index]

    const [text, setText] = useState(message.text)
    const [model, setModel] = useState<Model>(messages[index + 1].model || "SmolLM2-1.7B")

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

                    response.json().then(chat => setChats(previous => previous.map(c => c.uuid === chat.uuid ? chat : c)))
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
            toAddUI.push({ id, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type })
        }

        if (toAddFiles.length > 0) {
            setAddedFiles(previous => [...previous, ...toAddFiles.map(([_, f]) => f)])
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
        const added: MessageFile[] = addedFiles.map((f, i) => ({ id: highestFileID + i + 1, name: f.name, content: f.slice(), content_size: f.size, content_type: f.type }))
        return [...current, ...added]
    }

    return (
        <Composer
            text={text}
            setText={setText}
            files={getCurrentFiles()}
            model={model}
            setModel={setModel}
            withBorderAndShadow={false}
            tabIndex={3}
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