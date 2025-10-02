import React from "react"

export default function Button({ icon, onClick, isDisabled = false }: {
    icon: React.ReactNode
    onClick?: () => void
    isDisabled?: boolean
}) {
    return (
        <button
            className="my-2 p-1 rounded-3xl hover:bg-gray-600 light:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDisabled}
            onClick={onClick}
        >
            {icon}
        </button>
    )
}