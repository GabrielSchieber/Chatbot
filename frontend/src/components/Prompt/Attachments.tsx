import { Cross2Icon, FileIcon } from "@radix-ui/react-icons"
import { useState } from "react"

import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { getFileSize, getFileType } from "../../utils/file"
import type { MessageFile, UIAttachment } from "../../types"

type AttachmentsProps = {
    currentFiles: File[]
    setCurrentFiles: React.Dispatch<React.SetStateAction<File[]>>
    visibleFiles: UIAttachment[]
    setVisibleFiles: React.Dispatch<React.SetStateAction<UIAttachment[]>>
}

export default function Attachments({ currentFiles, setCurrentFiles, visibleFiles, setVisibleFiles }: AttachmentsProps) {
    const [isRemovingFiles, setIsRemovingFiles] = useState(false)

    function getTotalSize(messageFiles: MessageFile[]) {
        return messageFiles.map(file => file.content_size).reduce((total, size) => total + size, 0)
    }

    function removeFile(messageFile: MessageFile) {
        setVisibleFiles(previous => previous.map(file => ({
            messageFile: file.messageFile,
            isBeingRemoved: file.messageFile.id !== messageFile.id ? false : true,
            isNew: false
        })))
        setCurrentFiles(previous => previous.filter(file => file.name + "|" + file.size !== messageFile.name + "|" + messageFile.content_size))
        setTimeout(() => setVisibleFiles(previous => previous.filter(file => file.messageFile.id !== messageFile.id)), 300)
    }

    function removeFiles() {
        setIsRemovingFiles(true)
        setCurrentFiles([])
        setTimeout(() => {
            setVisibleFiles([])
            setIsRemovingFiles(false)
        }, 300)
    }

    const messageFiles = visibleFiles.map(f => f.messageFile)

    return (
        <div
            className={`
                relative flex flex-col gap-1 p-2 border border-gray-500 top-0 rounded-xl
                transition-all duration-300 ${isRemovingFiles ? "opacity-0 overflow-y-hidden" : "opacity-100"}
            `}
            style={{ maxHeight: isRemovingFiles ? 0 : visibleFiles.length * 120, display: visibleFiles.length === 0 ? "none" : "flex" }}
            onClick={e => e.stopPropagation()}
        >
            {visibleFiles.map(file => (
                <div
                    key={file.messageFile.id + "|" + file.messageFile.name + "|" + file.messageFile.content_size}
                    className={`
                            relative flex gap-1 p-2 w-fit items-center bg-gray-800/50 rounded-xl
                            transition-all duration-300 ${file.isBeingRemoved ? "opacity-0 translate-x-10" : "opacity-100"}
                        `}
                >
                    {getFileType(file.messageFile.name) === "Image" ? (
                        <img
                            src={URL.createObjectURL(currentFiles.find(currentFile => currentFile.name === file.messageFile.name) || new Blob())}
                            alt={file.messageFile.name}
                            className="size-14 object-cover rounded-lg"
                        />
                    ) : (
                        <FileIcon className="size-14 bg-gray-800 p-2 rounded-lg" />
                    )}
                    <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                        <p className="px-2 py-1 rounded-lg bg-gray-800">
                            Type: {getFileType(file.messageFile.name)}<br />
                            Name: {file.messageFile.name}<br />
                            Size: {getFileSize(file.messageFile.content_size)}
                        </p>
                    </div>
                    <button
                        className="absolute top-0 right-0 translate-x-2 -translate-y-2 cursor-pointer text-red-400 hover:text-red-500"
                        onClick={_ => removeFile(file.messageFile)}
                    >
                        <Cross2Icon className="size-4" />
                    </button>
                </div>
            ))}
            <div className="flex gap-1">
                <p className="text-sm px-2 rounded bg-gray-600">Files: {messageFiles.length}/{MAX_FILES}</p>
                <p className="text-sm px-2 rounded bg-gray-600">Size: {getFileSize(getTotalSize(messageFiles))} / {getFileSize(MAX_FILE_SIZE)}</p>
            </div>
            <button className="absolute right-0 -translate-x-2 cursor-pointer text-red-400 hover:text-red-500" onClick={removeFiles}>
                <Cross2Icon />
            </button>
        </div>
    )
}