import { CheckIcon, ChevronDownIcon, Cross1Icon, EnvelopeClosedIcon, GearIcon, LockClosedIcon, MixerHorizontalIcon, MixerVerticalIcon, PersonIcon } from "@radix-ui/react-icons"
import { t } from "i18next"
import { Dialog, Select, Tabs } from "radix-ui"
import { useState, useEffect, type ReactNode, type SetStateAction, type Dispatch } from "react"
import { useTranslation } from "react-i18next"

import { ArchivedChatsDialog } from "../ui/ArchivedChatsDialog"
import ConfirmDialog from "../ui/ConfirmDialog"
import Customizations from "../ui/Customizations"
import MFADialog from "../ui/MFADialog"
import { useAuth } from "../../context/AuthProvider"
import { useChat } from "../../context/ChatProvider"
import { deleteAccount, deleteChats, logout, me } from "../../utils/api"
import { applyTheme } from "../../utils/theme"
import { getLanguageAbbreviation } from "../../utils/language"
import type { Language, Theme } from "../../types"

export default function Settings({ isSidebarOpen, itemClassNames }: { isSidebarOpen: boolean, itemClassNames: string }) {
    const { user } = useAuth()

    const [currentTab, setCurrentTab] = useState(t("settings.general"))

    return (
        <Dialog.Root>
            <Dialog.Trigger className={itemClassNames} data-testid="open-settings">
                <GearIcon className="size-5" /> {isSidebarOpen && t("sidebar.settings")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Title hidden>{t("sidebar.settings")}</Dialog.Title>
                <Dialog.Description hidden>{t("sidebar.settings")}</Dialog.Description>

                <Dialog.Content>
                    <Tabs.Root
                        className="fixed flex top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 text-white light:text-black"
                        value={currentTab}
                        onValueChange={v => setCurrentTab(v)}
                        orientation="vertical"
                    >
                        <Tabs.List className="flex flex-col gap-1 p-4 items-start rounded-l-xl bg-gray-900 light:bg-gray-100">
                            <Dialog.Close className={"ml-1 p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"} data-testid="close-settings">
                                <Cross1Icon className="size-5" />
                            </Dialog.Close>

                            <Trigger icon={<GearIcon className="size-4.5" />} title={t("settings.general")} />
                            <Trigger icon={<MixerVerticalIcon className="size-4.5" />} title="Customizations" />
                            <Trigger icon={<MixerHorizontalIcon className="size-4.5" />} title={t("settings.data")} />
                            <Trigger icon={<LockClosedIcon className="size-4.5" />} title={t("settings.security")} />
                            <Trigger icon={<PersonIcon className="size-4.5" />} title={t("settings.account")} />
                        </Tabs.List >

                        <Content title={t("settings.general")}>
                            <Entry name={t("settings.theme")} item={<ThemeEntryItem />} />
                            <Entry name={t("settings.language")} item={<LanguageEntryItem setCurrentTab={setCurrentTab} />} />
                        </Content>

                        <Content title="Customizations">
                            <Customizations />
                        </Content>

                        <Content title={t("settings.data")}>
                            <Entry name={t("settings.archivedChats")} item={<ArchivedChatsDialog triggerClassName={entryClasses} />} />
                            <Entry name={t("settings.deleteChats")} item={<DeleteChatsEntryItem />} />
                        </Content>

                        <Content title={t("settings.security")}>
                            <Entry name={t("settings.mfa")} item={<MFADialog triggerClassName={entryClasses} />} />
                            <Entry name={t("settings.logout")} item={<LogoutEntryItem />} />
                        </Content>

                        <Content title={t("settings.account")}>
                            {user && (
                                <div className="flex gap-2 py-3 items-center">
                                    <EnvelopeClosedIcon className="size-4.5" />
                                    <p>{user.email}</p>
                                </div>
                            )}
                            <Entry name={t("settings.deleteAccount")} item={<DeleteAccountEntryItem />} />
                        </Content>
                    </Tabs.Root>
                </Dialog.Content >
            </Dialog.Portal >
        </Dialog.Root >
    )
}

function Trigger({ icon, title }: { icon: ReactNode, title: string }) {
    return (
        <Tabs.Trigger
            value={title}
            className={`
                flex w-full gap-1 px-2 py-1 items-center cursor-pointer outline-none rounded-lg
                hover:bg-gray-700 light:hover:bg-gray-300
                focus:bg-gray-700 light:focus:bg-gray-300
                data-[state=active]:bg-gray-700 light:data-[state=active]:bg-gray-300
            `}
        >
            {icon} {title}
        </Tabs.Trigger>
    )
}

function Content({ title, children }: { title: string, children: ReactNode }) {
    return (
        <Tabs.Content value={title} className="min-w-100 rounded-r-xl bg-gray-800 light:bg-gray-200" tabIndex={-1}>
            <section className="flex flex-col">
                <h2 className="p-4 mb-1 text-xl font-semibold border-b">{title}</h2>
                <div className="flex flex-col px-4 divide-y divide-gray-500">
                    {children}
                </div>
            </section>
        </Tabs.Content>
    )
}

function ThemeEntryItem() {
    const { user, setUser } = useAuth()
    const [theme, setTheme] = useState(user?.preferences.theme || "System")

    function isTheme(value: unknown): value is Theme {
        return value === "System" || value === "Light" || value === "Dark"
    }

    function handleChangeTheme(themeValue: string) {
        const themeToSelect = isTheme(themeValue) ? themeValue : "System"
        me(undefined, themeToSelect)
        setUser(previous => previous ? ({ ...previous, preferences: { ...previous.preferences, theme: themeToSelect } }) : previous)
        setTheme(themeToSelect)
        applyTheme(themeToSelect)
    }

    return (
        <Select.Root value={theme} onValueChange={handleChangeTheme}>
            <Select.Trigger className={entryClasses + " gap-4"} aria-label="Theme">
                <Select.Value placeholder={"settings.selectTheme"} />
                <Select.Icon>
                    <ChevronDownIcon />
                </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
                <Select.Content className="text-white light:text-black bg-gray-900 light:bg-gray-100">
                    <Select.Viewport className="p-1">
                        <Select.Item value="System" className={itemClasses}>
                            <Select.ItemText>{t("settings.theme.system")}</Select.ItemText>
                            <Select.ItemIndicator className="ml-auto">
                                <CheckIcon />
                            </Select.ItemIndicator>
                        </Select.Item>

                        <Select.Item value="Light" className={itemClasses}>
                            <Select.ItemText>{t("settings.theme.light")}</Select.ItemText>
                            <Select.ItemIndicator className="ml-auto">
                                <CheckIcon />
                            </Select.ItemIndicator>
                        </Select.Item>

                        <Select.Item value="Dark" className={itemClasses}>
                            <Select.ItemText>{t("settings.theme.dark")}</Select.ItemText>
                            <Select.ItemIndicator className="ml-auto">
                                <CheckIcon />
                            </Select.ItemIndicator>
                        </Select.Item>
                    </Select.Viewport>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

function LanguageEntryItem({ setCurrentTab }: { setCurrentTab: Dispatch<SetStateAction<string>> }) {
    const { user, setUser } = useAuth()
    const { i18n } = useTranslation()

    const [language, setLanguage] = useState<Language>(user?.preferences.language || "")

    const languages: Language[] = ["", "English", "Português"]
    const autoDetect = t("settings.autoDetect")

    async function handleChangeLanguage(language: Language) {
        me(language)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, language } } : previous)
        setLanguage(language)
        const t = await i18n.changeLanguage(getLanguageAbbreviation(language))
        setCurrentTab(t("settings.general"))
    }

    const getValue = (l: Language) => l ? l : autoDetect

    return (
        <Select.Root value={getValue(language)} onValueChange={v => handleChangeLanguage(v === autoDetect ? "" : v as Language)}>
            <Select.Trigger className={entryClasses + " gap-4"} aria-label="Language">
                <Select.Value placeholder={t("settings.selectLanguage")} />
                <Select.Icon>
                    <ChevronDownIcon />
                </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
                <Select.Content className="text-white light:text-black bg-gray-900 light:bg-gray-100">
                    <Select.Viewport className="p-1">
                        {languages.map((l, i) => (
                            <Select.Item key={`${l}-${i}`} value={getValue(l)} className={itemClasses}>
                                <Select.ItemText>{getValue(l)}</Select.ItemText>
                                <Select.ItemIndicator className="ml-auto">
                                    <CheckIcon />
                                </Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Select.Viewport>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    )
}

function DeleteChatsEntryItem() {
    const { setChats } = useChat()

    function handleDeleteChats() {
        deleteChats().then(response => {
            if (response.ok) {
                if (location.pathname.includes("chat")) {
                    location.href = "/"
                } else {
                    setChats([])
                }
            } else {
                alert(t("dialogs.deleteChats.error"))
            }
        })
    }

    return (
        <ConfirmDialog
            trigger={
                <button className={destructiveEntryClasses}>
                    {t("dialogs.deleteChats.confirm")}
                </button>
            }
            title={t("dialogs.deleteChats.title")}
            description={t("dialogs.deleteChats.description")}
            confirmText={t("dialogs.deleteChats.confirm")}
            cancelText={t("dialogs.deleteChats.cancel")}
            onConfirm={handleDeleteChats}
        />
    )
}

function DeleteAccountEntryItem() {
    const { user } = useAuth()

    const [isOpen, setIsOpen] = useState(false)
    const [password, setPassword] = useState("")
    const [mfaCode, setMFACode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) {
            setPassword("")
            setMFACode("")
            setIsLoading(false)
            setError(null)
        }
    }, [isOpen])

    async function handleConfirmDelete() {
        setError(null)

        if (!password) {
            setError(t("dialogs.deleteAccount.error.passwordRequired"))
            return
        }

        if (user?.mfa?.is_enabled && !mfaCode) {
            setError(t("dialogs.deleteAccount.error.mfaRequired"))
            return
        }

        try {
            setIsLoading(true)
            const response = await deleteAccount(password, user?.mfa?.is_enabled ? mfaCode : undefined)
            if (response.ok) {
                location.reload()
            } else {
                const json = await response.json().catch(() => ({}))
                setError(json.error || t("dialogs.deleteAccount.error.deletionFailed"))
            }
        } catch (err) {
            setError(t("dialogs.deleteAccount.error.network"))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Trigger className={destructiveEntryClasses} data-testid="open-delete-account">
                {t("dialogs.deleteAccount.button")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="
                        fixed w-80  p-4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        rounded-xl text-white light:text-black bg-gray-800 light:bg-gray-200
                    "
                >
                    <div className="flex justify-between items-center mb-2">
                        <Dialog.Title className="text-lg font-semibold">{t("dialogs.deleteAccount.title")}</Dialog.Title>
                        <Dialog.Description hidden>{t("dialogs.deleteAccount.title")}</Dialog.Description>
                        <Dialog.Close className="p-1 rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300">
                            <Cross1Icon />
                        </Dialog.Close>
                    </div>

                    <div className="text-sm mb-3">
                        {user?.mfa?.is_enabled ? t("dialogs.deleteAccount.descriptionWithMFA") : t("dialogs.deleteAccount.description")}
                    </div>

                    <div className="flex flex-col gap-2">
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={t("dialogs.deleteAccount.passwordPlaceholder")}
                            className="px-2 py-1 rounded border bg-gray-900 light:bg-white light:text-black"
                            disabled={isLoading}
                        />

                        {user?.mfa?.is_enabled && (
                            <input
                                type="text"
                                value={mfaCode}
                                onChange={e => setMFACode(e.target.value)}
                                placeholder={t("dialogs.deleteAccount.mfaPlaceholder")}
                                className="px-2 py-1 rounded border bg-gray-900 light:bg-white light:text-black"
                                disabled={isLoading}
                            />
                        )}

                        {error && <div className="text-red-400 text-sm">{error}</div>}

                        <div className="flex justify-end gap-2 mt-2">
                            <Dialog.Close asChild>
                                <button className={entryClasses} disabled={isLoading}>{t("dialogs.deleteAccount.cancel")}</button>
                            </Dialog.Close>
                            <button className={destructiveEntryClasses} onClick={handleConfirmDelete} disabled={isLoading}>
                                {isLoading ? t("dialogs.deleteAccount.confirming") : t("dialogs.deleteAccount.confirm")}
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function LogoutEntryItem() {
    async function handleLogout() {
        await logout()
        location.reload()
    }

    return (
        <button className={entryClasses} onClick={handleLogout}>
            {t("settings.logout")}
        </button>
    )
}

function Entry({ name, item }: { name: string, item: ReactNode }) {
    return (
        <div className="flex gap-3 md:gap-20 py-2 items-center justify-between">
            <label>{name}</label>
            {item}
        </div>
    )
}

const entryClasses = `
    flex px-2 py-1 items-center justify-center rounded-lg cursor-pointer
    border border-gray-500
    hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300
`
const destructiveEntryClasses = entryClasses + " text-red-500"
const itemClasses = "flex items-center gap-4 px-2 py-1 rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"