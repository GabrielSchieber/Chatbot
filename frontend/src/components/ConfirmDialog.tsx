import { AlertDialog } from "radix-ui"
import { type ReactNode } from "react"

export default function ConfirmDialog({
    trigger,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = true,
    onConfirm
}: {
    trigger: ReactNode
    title: string
    description?: string
    confirmText?: string
    cancelText?: string
    onConfirmClassName?: string
    onCancelClassName?: string
    isDestructive?: boolean
    onConfirm: () => void
}) {
    return (
        <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
                {trigger}
            </AlertDialog.Trigger>

            <AlertDialog.Portal>
                <AlertDialog.Overlay className="bg-black/50 fixed inset-0" />
                <AlertDialog.Content
                    className="
                        fixed w-[90vw] max-w-sm p-6 rounded-xl shadow-xl top-1/2 left-1/2
                        -translate-x-1/2 -translate-y-1/2 bg-gray-800 light:bg-gray-200
                    "
                >
                    <AlertDialog.Title className="text-lg font-semibold text-white light:text-black">
                        {title}
                    </AlertDialog.Title>
                    {description && (
                        <AlertDialog.Description className="mt-2 text-sm text-gray-300 light:text-gray-700">
                            {description}
                        </AlertDialog.Description>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                        <AlertDialog.Cancel
                            className="
                                px-4 py-2 rounded cursor-pointer text-white light:text-black
                                bg-gray-700 hover:bg-gray-500/50 light:bg-gray-300
                            "
                        >
                            {cancelText}
                        </AlertDialog.Cancel>

                        <AlertDialog.Action
                            className={"px-4 py-2 rounded cursor-pointer " +
                                (isDestructive ?
                                    "text-white bg-red-600 hover:bg-red-700" :
                                    "text-white light:text-black bg-gray-700 hover:bg-gray-500/50 light:bg-gray-300"
                                )
                            }
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