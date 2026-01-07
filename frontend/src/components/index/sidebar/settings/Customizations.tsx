import { t } from "i18next"
import { Label as RadixLabel } from "radix-ui"
import { useState, useEffect, type ReactNode, useRef } from "react"

import { useAuth } from "../../../../providers/AuthProvider"
import { me } from "../../../../utils/api"

export default function Customizations() {
    const { user, setUser } = useAuth()

    const [customInstructions, setCustomInstructions] = useState<string | undefined>(undefined)
    const [nickname, setNickname] = useState<string | undefined>(undefined)
    const [occupation, setOccupation] = useState<string | undefined>(undefined)
    const [about, setAbout] = useState<string | undefined>(undefined)

    async function resetCustomization() {
        setCustomInstructions(undefined)
        setNickname(undefined)
        setOccupation(undefined)
        setAbout(undefined)
    }

    async function saveCustomization() {
        await me(undefined, undefined, undefined, customInstructions, nickname, occupation, about)

        setUser(previous => previous
            ? {
                ...previous,
                preferences: {
                    ...previous.preferences,
                    custom_instructions: customInstructions !== undefined ? customInstructions : previous.preferences.custom_instructions,
                    nickname: nickname !== undefined ? nickname : previous.preferences.nickname,
                    occupation: occupation !== undefined ? occupation : previous.preferences.occupation,
                    about: about !== undefined ? about : previous.preferences.about
                }
            } : previous
        )

        await resetCustomization()
    }

    return (
        <>
            <Entry>
                <Label htmlFor="custom-instructions" text={t("settings.customInstructions")} />
                <TextArea
                    id="custom-instructions"
                    placeholder={t("settings.customInstructionsPlaceholder")}
                    value={customInstructions !== undefined ? customInstructions : user !== null ? user.preferences.custom_instructions : ""}
                    onChange={e => setCustomInstructions(e.currentTarget.value)}
                />
            </Entry>
            <Entry>
                <Label htmlFor="nickname" text={t("settings.nickname")} />
                <Input
                    id="nickname"
                    placeholder={t("settings.nicknamePlaceholder")}
                    value={nickname !== undefined ? nickname : user !== null ? user.preferences.nickname : ""}
                    onChange={e => setNickname(e.currentTarget.value)}
                />
            </Entry>
            <Entry>
                <Label htmlFor="occupation" text={t("settings.occupation")} />
                <Input
                    id="occupation"
                    placeholder={t("settings.occupationPlaceholder")}
                    value={occupation !== undefined ? occupation : user !== null ? user.preferences.occupation : ""}
                    onChange={e => setOccupation(e.currentTarget.value)}
                />
            </Entry>
            <Entry>
                <Label htmlFor="about" text={t("settings.about")} />
                <TextArea
                    id="about"
                    placeholder={t("settings.aboutPlaceholder")}
                    value={about !== undefined ? about : user !== null ? user.preferences.about : ""}
                    onChange={e => setAbout(e.currentTarget.value)}
                />
            </Entry>

            {[customInstructions, nickname, occupation, about].some(f => f !== undefined) && (
                <div className="flex gap-1 my-4 items-center justify-end">
                    <button className="px-2 py-1 rounded-lg cursor-pointer border border-gray-500 hover:bg-gray-500/50" onClick={resetCustomization}>
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

function Label({ htmlFor, text }: { htmlFor: string, text: string }) {
    return (
        <RadixLabel.Root htmlFor={htmlFor} className="pl-1 pb-1 font-semibold">
            {text}
        </RadixLabel.Root>
    )
}

function TextArea({ id, placeholder, value, onChange }: { id: string, placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
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
                id={id}
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

function Input({ id, placeholder, value, onChange }: { id: string, placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
    return (
        <input
            id={id}
            className="w-full px-2 py-1 rounded-lg outline-none border border-gray-500/50 bg-gray-700/50 light:bg-gray-300/50"
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            maxLength={50}
        />
    )
}