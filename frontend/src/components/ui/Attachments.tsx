import { Cross1Icon, FileIcon } from "@radix-ui/react-icons"
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"

import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { getMessageFileContent } from "../../utils/api"
import { getFileSize, getFileType } from "../../utils/file"
import type { MessageFile } from "../../types"

export default function Attachments({ files, onRemove, onRemoveAll }: { files: MessageFile[], onRemove?: (file: MessageFile) => void, onRemoveAll?: () => void }) {
    return (
        <div className="relative flex flex-1 flex-col gap-1 items-start">
            {files.map(f => (
                <Attachment key={f.id} file={f} onRemove={onRemove} />
            ))}
            {files.length > 0 &&
                <div className="flex gap-1 text-sm">
                    <p className="px-2.5 py-1 rounded-lg bg-gray-800 light:bg-gray-200">
                        Files: {files.length}/{MAX_FILES}
                    </p>
                    <p className="px-2.5 py-1 rounded-lg bg-gray-800 light:bg-gray-200">
                        Size: {getFileSize(files.map(f => f.content_size).reduce((a, c) => a + c, 0))}/{getFileSize(MAX_FILE_SIZE)}
                    </p>
                </div>
            }
            {onRemoveAll && files.length > 0 &&
                <button className="absolute right-0 p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={onRemoveAll}>
                    <Cross1Icon className="size-3.5" />
                </button>
            }
        </div>
    )
}

function Attachment({ file, onRemove }: { file: MessageFile, onRemove?: (file: MessageFile) => void }) {
    return (
        <div className="flex px-2 py-1 gap-1 items-center rounded-md bg-gray-800 light:bg-gray-200">
            {getFileType(file.name) === "Image" ? (
                <ImageIcon file={file} />
            ) : (
                <FileIcon className="size-14 p-1 rounded-md bg-gray-700 light:bg-gray-300" />
            )}
            <div className="flex flex-col px-2 py-1 text-xs rounded-md bg-gray-700 light:bg-gray-300">
                Type: {getFileType(file.name)}<br />
                Name: {file.name}<br />
                Size: {getFileSize(file.content_size)}
            </div>
            {onRemove &&
                <button className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={() => onRemove(file)}>
                    <Cross1Icon className="size-3.5" />
                </button>
            }
        </div>
    )
}

function ImageIcon({ file }: { file: MessageFile }) {
    const { chatUUID } = useParams()

    const [data, setData] = useState<Blob | undefined>(file.content)
    const shouldLoadContent = useRef(true)

    useEffect(() => {
        if (chatUUID && data === undefined && shouldLoadContent.current) {
            shouldLoadContent.current = false
            getMessageFileContent(chatUUID, file.id).then(response => {
                if (response.ok) {
                    response.blob().then(data => setData(data))
                }
            })
        }
    }, [])

    return (
        data !== undefined ? (
            <img className="size-14 object-cover rounded-md" src={URL.createObjectURL(data || new Blob)} />
        ) : (
            <svg className="size-14 object-cover rounded-md animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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