import { Cross1Icon, FileIcon } from "@radix-ui/react-icons"

import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { getFileSize, getFileType } from "../../utils/file"
import type { MessageFile } from "../../types"

export default function Attachments({ files, onRemove, onRemoveAll }: { files: MessageFile[], onRemove?: (file: MessageFile) => void, onRemoveAll?: () => void }) {
    return (
        <div className="relative flex flex-1 flex-col gap-2 items-start">
            {files.map(f => (
                onRemove ? <Attachment key={f.id} file={f} onRemove={() => onRemove(f)} /> : <Attachment key={f.id} file={f} />
            ))}
            {files.length > 0 &&
                <div className="flex gap-2">
                    <p className="px-2.5 rounded-lg bg-gray-800 light:bg-gray-200" >
                        Files: {files.length}/{MAX_FILES}
                    </p>
                    <p className="px-2.5 rounded-lg bg-gray-800 light:bg-gray-200">
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

function Attachment({ file, onRemove }: { file: MessageFile, onRemove?: () => void }) {
    return (
        <div className="flex px-4 gap-1 items-center rounded-md bg-gray-800 light:bg-gray-200">
            <FileIcon className="size-8" />
            <div className="flex flex-col gap-0.5 text-[12px] font-semibold">
                <p className="px-2 py-1 rounded-lg bg-gray-800">
                    Type: {getFileType(file.name)}<br />
                    Name: {file.name}<br />
                    Size: {getFileSize(file.content_size)}
                </p>
            </div>
            {onRemove &&
                <button className="p-1 rounded-3xl cursor-pointer hover:bg-red-500/40" onClick={onRemove}>
                    <Cross1Icon className="size-3.5" />
                </button>
            }
        </div>
    )
}