import { useState, useEffect, type ReactNode, useRef } from "react"

import { useAuth } from "../../context/AuthProvider"
import { me } from "../../utils/api"

export default function Customizations() {
    const { user, setUser } = useAuth()

    const [customInstructions, setCustomInstructions] = useState(user?.preferences.custom_instructions || "")
    const [nickname, setNickname] = useState(user?.preferences.nickname || "")
    const [occupation, setOccupation] = useState(user?.preferences.occupation || "")
    const [about, setAbout] = useState(user?.preferences.about || "")

    const hasAnyChanged = [
        customInstructions !== user?.preferences.custom_instructions,
        nickname !== user?.preferences.nickname,
        occupation !== user?.preferences.occupation,
        about !== user?.preferences.about
    ].some(f => f)

    async function cancelCustomization() {
        setCustomInstructions(user?.preferences.custom_instructions || "")
        setNickname(user?.preferences.nickname || "")
        setOccupation(user?.preferences.occupation || "")
        setAbout(user?.preferences.about || "")
    }

    async function saveCustomization() {
        await me(undefined, undefined, customInstructions, nickname, occupation, about)
        setUser(previous => previous
            ? {
                ...previous,
                preferences: {
                    ...previous.preferences,
                    custom_instructions: customInstructions,
                    nickname,
                    occupation,
                    about
                }
            } : previous
        )
    }

    return (
        <>
            <Entry>
                <Label text="Custom instructions" />
                <TextArea
                    placeholder="Type your preferences..."
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.currentTarget.value)}
                />
            </Entry>
            <Entry>
                <Label text="Nickname" />
                <Input
                    placeholder="What should I call you?"
                    value={nickname}
                    onChange={e => setNickname(e.currentTarget.value)}
                />
            </Entry>
            <Entry>
                <Label text="Occupation" />
                <Input
                    placeholder="Your role..."
                    value={occupation}
                    onChange={e => setOccupation(e.currentTarget.value)}
                />
            </Entry>
            <Entry>
                <Label text="About" />
                <TextArea
                    placeholder="Is there anything else that I should know about?"
                    value={about}
                    onChange={e => setAbout(e.currentTarget.value)}
                />
            </Entry>

            {hasAnyChanged && (
                <div className="flex gap-1 my-4 items-center justify-end">
                    <button className="px-2 py-1 rounded-lg cursor-pointer border border-gray-500 hover:bg-gray-500/50" onClick={cancelCustomization}>
                        Cancel
                    </button>
                    <button
                        className="
                            px-2 py-1 rounded-lg cursor-pointer text-black light:text-white border border-gray-500
                            bg-gray-100 hover:bg-gray-200 light:bg-gray-900 light:hover:bg-gray-800
                        "
                        onClick={saveCustomization}
                    >
                        Save
                    </button>
                </div>
            )}
        </>
    )
}

function Entry({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col mt-2 pb-4">
            {children}
        </div>
    )
}

function Label({ text }: { text: string }) {
    return <p className="px-2 font-semibold">{text}</p>
}

function TextArea({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
    const ref = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        if (ref.current) {
            ref.current.style.height = "auto"
            ref.current.style.height = ref.current.scrollHeight + "px"
        }
    }, [value])

    return (
        <div className="flex flex-1 max-h-40 overflow-y-auto rounded-lg border border-gray-500/50 bg-gray-700/50 light:bg-gray-300/50">
            <textarea
                ref={ref}
                className="flex-1 px-2 py-1 overflow-hidden resize-none outline-none"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                rows={1}
                maxLength={1000}
            />
        </div>
    )
}

function Input({ placeholder, value, onChange }: { placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
    return (
        <input
            className="w-full px-2 py-1 rounded-lg outline-none border border-gray-500/50 bg-gray-700/50 light:bg-gray-300/50"
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            maxLength={50}
        />
    )
}