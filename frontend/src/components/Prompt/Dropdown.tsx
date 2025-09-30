import { BoxModelIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, GearIcon, PlusIcon, UploadIcon } from "@radix-ui/react-icons"
import { useState } from "react"
import type { Model, Options, UIAttachment } from "../../types"
import { MAX_FILE_SIZE, MAX_FILES } from "../Chat"
import { getFileSize } from "../../utils/file"

type DropdownProps = {
    isPromptBarCentered: boolean
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
    options: Options
    setOptions: React.Dispatch<React.SetStateAction<Options>>
    currentFiles: File[]
    setCurrentFiles: React.Dispatch<React.SetStateAction<File[]>>
    visibleFiles: UIAttachment[]
    setVisibleFiles: React.Dispatch<React.SetStateAction<UIAttachment[]>>
    fileInputRef: React.RefObject<HTMLInputElement | null>
}

export default function Dropdown({
    isPromptBarCentered,
    model,
    setModel,
    options,
    setOptions,
    currentFiles,
    setCurrentFiles,
    visibleFiles,
    setVisibleFiles,
    fileInputRef
}: DropdownProps) {
    type OptionKey = "num_predict" | "temperature" | "top_p" | "seed"

    function OptionItem(optionKey: OptionKey) {
        function clamp(value: number, minimum: number, maximum: number) {
            return Math.max(Math.min(value, maximum), minimum)
        }

        function getOptionName() {
            switch (optionKey) {
                case "num_predict": return "🔣 Max. Tokens"
                case "temperature": return "🌡 Temperature"
                case "top_p": return "⬆ Top P"
                case "seed": return "🌱 Seed"
            }
        }

        function getOptionValue() {
            if (optionKey === currentOption?.key) {
                return currentOption.value
            } else if (options[optionKey] !== undefined) {
                return options[optionKey]
            } else {
                return "Random"
            }
        }

        function handleSetOptions(value: string) {
            setCurrentOption(null)
            setOptions(previous => {
                const newOptions = { ...previous }
                if (optionKey === "num_predict" || optionKey === "seed") {
                    if (optionKey === "seed" && value === "Random") {
                        newOptions.seed = undefined
                    } else {
                        const parsedValue = parseInt(value)
                        if (isFinite(parsedValue)) {
                            newOptions[optionKey] = optionKey === "num_predict" ? clamp(parsedValue, 32, 4096) : parsedValue
                        }
                    }
                } else {
                    const parsedValue = parseInt(value)
                    if (isFinite(parsedValue)) {
                        newOptions[optionKey] = clamp(parseFloat(value), 0.1, 2)
                    }
                }
                return newOptions
            })
        }

        return (
            <div className="flex gap-3 px-2 py-1 items-center rounded bg-gray-700 light:bg-gray-300">
                <p className="flex-1 text-center truncate">{getOptionName()}</p>
                <input
                    className="
                            px-2 py-1 rounded outline-none bg-gray-600 light:bg-gray-400/50 hover:bg-gray-500
                            light:hover:bg-gray-400/75 select:bg-gray-500 light:select:bg-gray-400/75
                        "
                    value={getOptionValue()}
                    onChange={e => setCurrentOption({ key: optionKey, value: e.target.value })}
                    onBlur={_ => currentOption && handleSetOptions(currentOption.value)}
                    onKeyDown={e => e.key === "Enter" && currentOption && handleSetOptions(currentOption.value)}
                />
            </div>
        )
    }

    function ModelItem(modelName: "SmolLM2-135M" | "SmolLM2-360M" | "SmolLM2-1.7B" | "Moondream") {
        return (
            <button
                className={`
                        flex gap-1 w-40 px-2 py-1 items-center justify-between rounded truncate cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400/50
                        ${modelName === model ? "bg-gray-600/90 light:bg-gray-400/40" : "bg-gray-700 light:bg-gray-300"}
                    `}
                onClick={_ => setModel(modelName)}
            >
                {modelName}
                {modelName === model && <CheckIcon className="size-5" />}
            </button>
        )
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files) return

        if (event.target.files.length + currentFiles.length > MAX_FILES) {
            alert(`You can only attach up to ${MAX_FILES} files at a time.`)
            event.target.value = ""
            return
        }

        const totalSize =
            visibleFiles.map(file => file.messageFile.content_size).reduce((total, size) => total + size, 0)
            + Array(...event.target.files).map(file => file.size).reduce((total, size) => total + size, 0)
        if (totalSize > MAX_FILE_SIZE) {
            alert(`Total file size exceeds ${getFileSize(MAX_FILE_SIZE)} limit. Please select smaller files.`)
            event.target.value = ""
            return
        }

        const newFiles = Array.from(event.target.files)
        const existingKeys = new Set(currentFiles.map(file => file.name + "|" + file.size))
        const uniqueNew = newFiles.filter(file => !existingKeys.has(file.name + "|" + file.size))

        setCurrentFiles(previous => [...previous, ...uniqueNew])

        const highestVisibleFileID = visibleFiles.map(file => file.messageFile.id).sort().at(-1) || 1
        setVisibleFiles(previous => [
            ...previous,
            ...uniqueNew.map((file, index) => ({
                messageFile: {
                    id: highestVisibleFileID + index + 1,
                    name: file.name,
                    content_size: file.size,
                    content_type: file.type
                },
                isBeingRemoved: false,
                isNew: false
            }))
        ])

        event.target.value = ""
    }

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isDropdownOptionsOpen, setIsDropdownOptionsOpen] = useState(false)
    const [isDropdownModelOpen, setIsDropdownModelOpen] = useState(false)
    const [currentOption, setCurrentOption] = useState<{ key: OptionKey, value: string } | null>(null)

    const buttonClassNames = "flex w-full px-1 gap-2 justify-between items-center cursor-pointer rounded hover:bg-gray-700 light:hover:bg-gray-300"
    const dropdownClassNames = "absolute flex flex-col gap-1 p-2 rounded-xl bg-gray-800 light:bg-gray-200"

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} multiple />

            <div className="relative flex flex-col self-end" onClick={e => e.stopPropagation()}>
                <button
                    className="p-1.5 rounded-3xl cursor-pointer hover:bg-gray-600 light:hover:bg-gray-400 z-2"
                    tabIndex={2}
                    onClick={_ => setIsDropdownOpen(!isDropdownOpen)}
                    data-testid="add-dropdown"
                >
                    <PlusIcon className="size-6" />
                </button>
                {isDropdownOpen && (
                    <>
                        <div className="fixed inset-0 z-1 cursor-auto" onClick={_ => setIsDropdownOpen(false)}></div>
                        <div
                            className={`
                            absolute flex flex-col gap-1 p-2 self-center items-center cursor-auto
                            ${isPromptBarCentered ? "top-12" : "bottom-12"} left-0 rounded-xl bg-gray-800 light:bg-gray-200 z-2`
                            }
                        >
                            <button
                                className={buttonClassNames}
                                onClick={_ => {
                                    setIsDropdownOptionsOpen(!isDropdownOptionsOpen)
                                    setIsDropdownModelOpen(false)
                                }}
                            >
                                <GearIcon /> Options {isDropdownOptionsOpen ? <ChevronRightIcon /> : <ChevronDownIcon />}
                            </button>

                            {isDropdownOptionsOpen && (
                                <div className={dropdownClassNames + " bottom-14 left-32"}>
                                    {OptionItem("num_predict")}
                                    {OptionItem("temperature")}
                                    {OptionItem("top_p")}
                                    {OptionItem("seed")}
                                </div>
                            )}

                            <button
                                className={buttonClassNames}
                                onClick={_ => {
                                    setIsDropdownModelOpen(!isDropdownModelOpen)
                                    setIsDropdownOptionsOpen(false)
                                }}
                            >
                                <BoxModelIcon /> Model {isDropdownModelOpen ? <ChevronRightIcon /> : <ChevronDownIcon />}
                            </button>

                            {isDropdownModelOpen && (
                                <div className={dropdownClassNames + ` ${isPromptBarCentered ? "-bottom-24" : "bottom-0"} left-32`}>
                                    {ModelItem("SmolLM2-135M")}
                                    {ModelItem("SmolLM2-360M")}
                                    {ModelItem("SmolLM2-1.7B")}
                                    {ModelItem("Moondream")}
                                </div>
                            )}

                            <button
                                className={buttonClassNames + " justify-start"}
                                onClick={_ => {
                                    fileInputRef.current?.click()
                                    setIsDropdownOpen(false)
                                }}>
                                <UploadIcon /> Add files
                            </button>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}