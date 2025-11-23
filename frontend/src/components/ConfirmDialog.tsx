import { AlertDialog } from "radix-ui"
import { type ReactNode } from "react"

export default function ConfirmDialog({
    trigger,
    title,
    description,
    onConfirm,
    cancelText = "Cancel",
    confirmText = "Confirm",
    isDestructive = true
}: {
    trigger: ReactNode
    title: string
    description: string
    onConfirm: () => void
    cancelText?: string
    confirmText?: string
    isDestructive?: boolean
}) {
    return (
        <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
                {trigger}
            </AlertDialog.Trigger>

            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 bg-black/50" />

                <AlertDialog.Content
                    className="
                        fixed flex flex-col top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[90vw] max-w-md gap-3 p-6 rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <AlertDialog.Title className="text-xl font-bold">
                        {title}
                    </AlertDialog.Title>

                    <AlertDialog.Description className="text-lg">
                        {description}
                    </AlertDialog.Description>

                    <div className="flex gap-3 justify-end text-lg font-semibold">
                        <AlertDialog.Cancel
                            className="
                                px-4 py-2 rounded cursor-pointer text-white light:text-black
                                bg-gray-700 hover:bg-gray-600 light:bg-gray-300 light:hover:bg-gray-400
                            "
                        >
                            {cancelText}
                        </AlertDialog.Cancel>

                        <AlertDialog.Action
                            className={`
                                px-4 py-2 rounded cursor-pointer
                                ${isDestructive ?
                                    "text-white bg-red-600 hover:bg-red-700" :
                                    "text-white light:text-black bg-gray-900 hover:bg-gray-900/30 light:bg-gray-100 light:hover:100/30"
                                }
                            `}
                            onClick={onConfirm}
                        >
                            {confirmText}
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    )
}