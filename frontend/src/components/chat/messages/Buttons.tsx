import { CheckIcon, CopyIcon } from "@radix-ui/react-icons"
import { Tooltip } from "radix-ui"
import { useState, type ReactNode } from "react"

export function Copy({ text }: { text: string }) {
    const [isChecked, setIsChecked] = useState(false)

    return (
        <Button
            trigger={isChecked ? <CheckIcon className="size-4.5" /> : <CopyIcon className="size-4.5" />}
            tooltip="Copy"
            onClick={() => {
                navigator.clipboard.writeText(text)
                setIsChecked(true)
                setTimeout(() => setIsChecked(false), 2000)
            }}
        />
    )
}

export function Button({ trigger, tooltip, onClick, isDisabled = false }: {
    trigger: ReactNode
    tooltip: ReactNode
    onClick: () => void
    isDisabled?: boolean
}) {
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger
                    className="p-2 rounded-lg hover:bg-gray-700 light:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onClick}
                    disabled={isDisabled}
                >
                    {trigger}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content className="text-white text-sm bg-black px-2 py-1 rounded-xl" side="bottom" sideOffset={3}>
                        {tooltip}
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    )
}