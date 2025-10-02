import React from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { CheckIcon } from "@radix-ui/react-icons"
import type { Model } from "../../types"

export default function Dropdown({ icon, model, setModel }: {
    icon: React.ReactNode
    model: Model
    setModel: React.Dispatch<React.SetStateAction<Model>>
}) {
    function Item({ m }: { m: Model }) {
        return (
            <DropdownMenu.Item
                className="p-2 rounded-md cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"
                onClick={() => setModel(m)}
            >
                <div className="flex gap-2 items-center">
                    {m}{m === model && <CheckIcon className="size-5" />}
                </div>
            </DropdownMenu.Item>
        )
    }

    const models: Model[] = ["SmolLM2-135M", "SmolLM2-360M", "SmolLM2-1.7B", "Moondream"]

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger className="p-1 rounded-md cursor-pointer hover:bg-gray-600 light:bg-gray-400">
                {icon}
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col gap-1 p-1 rounded-md bg-gray-800 light:bg-gray-200">
                {models.map(m => (
                    <Item key={m} m={m} />
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}