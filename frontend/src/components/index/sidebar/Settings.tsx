import { CheckIcon, ChevronDownIcon, Cross1Icon, EnvelopeClosedIcon, GearIcon, LockClosedIcon, MixerHorizontalIcon, MixerVerticalIcon, PersonIcon } from "@radix-ui/react-icons"
import { Dialog, Select, Tabs } from "radix-ui"
import { useState, type ReactNode, type SetStateAction, type Dispatch, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { ArchivedChatsDialog } from "./settings/ArchivedChatsDialog"
import Customizations from "./settings/Customizations"
import DeleteAccountDialog from "./settings/DeleteAccountDialog"
import MFADialog from "./settings/MFADialog"
import { OpenSettings } from "../../misc/Buttons"
import ConfirmDialog from "../../misc/ConfirmDialog"
import { useAuth } from "../../../providers/AuthProvider"
import { useChat } from "../../../providers/ChatProvider"
import { useNotify } from "../../../providers/NotificationProvider"
import { deleteChats, logout, logoutAllSessions, me } from "../../../utils/api"
import { applyTheme, getLanguageAbbreviation } from "../../../utils/misc"
import type { Language, Theme } from "../../../utils/types"

export default function Settings({ isSidebarOpen }: { isSidebarOpen: boolean }) {
    const { t } = useTranslation()

    const { user } = useAuth()
    const { isMobile } = useChat()

    const [currentTab, setCurrentTab] = useState<SettingsTab>("settings.general")

    const [isScreenHeightSmall, setIsScreenHeightSmall] = useState(window.innerHeight < 430)

    useEffect(() => {
        const onResize = () => setIsScreenHeightSmall(window.innerHeight < 430)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    if (!user) return

    return (
        <Dialog.Root>
            <OpenSettings withLabel={isSidebarOpen} />

            <Dialog.Portal>
                <Dialog.Overlay className="z-10 fixed inset-0 bg-black/50" />

                <Dialog.Title hidden>{t("sidebar.settings")}</Dialog.Title>
                <Dialog.Description hidden>{t("sidebar.settings")}</Dialog.Description>

                <Dialog.Content>
                    <Tabs.Root
                        className={`
                            z-10 fixed flex top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-white light:text-black
                            ${isMobile ? "flex-col inset-0 size-full" : isScreenHeightSmall ? "inset-0 w-150 h-full" : "w-150 min-h-105"}
                        `}
                        value={currentTab}
                        onValueChange={v => setCurrentTab(v as SettingsTab)}
                    >
                        <Tabs.List
                            className={`
                                flex gap-1 p-4 items-start bg-gray-900 light:bg-gray-100
                                ${isMobile ? "flex-row flex-wrap" : "flex-col overflow-y-auto"}
                                ${!isMobile && !isScreenHeightSmall && "rounded-l-xl"}
                            `}
                        >
                            <Dialog.Close className={"ml-1 p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"} data-testid="close-settings">
                                <Cross1Icon className="size-5" />
                            </Dialog.Close>

                            <Trigger icon={<GearIcon className="size-4.5" />} title={t("settings.general")} titleKey="settings.general" />
                            <Trigger icon={<MixerVerticalIcon className="size-4.5" />} title={t("settings.customizations")} titleKey="settings.customizations" />
                            <Trigger icon={<MixerHorizontalIcon className="size-4.5" />} title={t("settings.data")} titleKey="settings.data" />
                            {!user.is_guest &&
                                <Trigger icon={<LockClosedIcon className="size-4.5" />} title={t("settings.security")} titleKey="settings.security" />
                            }
                            <Trigger icon={<PersonIcon className="size-4.5" />} title={t("settings.account")} titleKey="settings.account" />
                        </Tabs.List>

                        <Content title={t("settings.general")} titleKey="settings.general" isScreenHeightSmall={isScreenHeightSmall}>
                            <Entry name={t("settings.theme")} item={<ThemeEntryItem />} />
                            <Entry name={t("settings.language")} item={<LanguageEntryItem setCurrentTab={setCurrentTab} />} />
                        </Content>

                        <Content title={t("settings.customizations")} titleKey="settings.customizations" isScreenHeightSmall={isScreenHeightSmall}>
                            <Customizations />
                        </Content>

                        <Content title={t("settings.data")} titleKey="settings.data" isScreenHeightSmall={isScreenHeightSmall}>
                            <Entry name={t("settings.archivedChats")} item={<ArchivedChatsDialog triggerClassName={entryClasses} />} />
                            <Entry name={t("settings.deleteChats")} item={<DeleteChatsEntryItem />} />
                        </Content>

                        <Content title={t("settings.security")} titleKey="settings.security" isScreenHeightSmall={isScreenHeightSmall}>
                            <Entry name={t("settings.mfa")} item={<MFADialog triggerClassName={entryClasses} />} />
                            <Entry name={t("settings.logout")} item={<LogoutEntryItem />} />
                            <SessionsEntryItem />
                        </Content>

                        <Content title={t("settings.account")} titleKey="settings.account" isScreenHeightSmall={isScreenHeightSmall}>
                            {!user.is_guest && (
                                <div className="flex gap-2 py-3 items-center">
                                    <EnvelopeClosedIcon className="size-4.5" />
                                    <p>{user.email}</p>
                                </div>
                            )}
                            <Entry
                                name={t("settings.deleteAccount")}
                                item={<DeleteAccountDialog entryClasses={entryClasses} destructiveEntryClasses={destructiveEntryClasses} />}
                            />
                        </Content>
                    </Tabs.Root>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function Trigger({ icon, title, titleKey }: { icon: ReactNode, title: string, titleKey: SettingsTab }) {
    const { isMobile } = useChat()

    return (
        <Tabs.Trigger
            value={titleKey}
            className={`
                flex gap-1 px-2 py-1 items-center cursor-pointer outline-none rounded-lg
                hover:bg-gray-700 light:hover:bg-gray-300
                focus:bg-gray-700 light:focus:bg-gray-300
                data-[state=active]:bg-gray-700 light:data-[state=active]:bg-gray-300
                ${!isMobile && "w-full"}
            `}
        >
            {icon} {title}
        </Tabs.Trigger>
    )
}

function Content({ title, titleKey, isScreenHeightSmall, children }: { title: string, titleKey: string, isScreenHeightSmall: boolean, children: ReactNode }) {
    const { isMobile } = useChat()

    return (
        <Tabs.Content
            value={titleKey}
            className={`flex grow overflow-y-auto bg-gray-800 light:bg-gray-200 ${!isMobile && !isScreenHeightSmall && "rounded-r-xl"}`}
            tabIndex={-1}
        >
            <section className="flex flex-col w-full">
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
    const { t } = useTranslation()

    if (!user) return

    const [theme, setTheme] = useState(user.preferences.theme || "System")

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
                <Select.Content className="z-10 rounded-lg text-white light:text-black bg-gray-900 light:bg-gray-100">
                    <Select.Viewport className="p-1">
                        {["System", "Light", "Dark"].map(s => (
                            <Select.Item key={s} value={s} className={itemClasses}>
                                <Select.ItemText>{t(`settings.theme.${s.toLowerCase()}`)}</Select.ItemText>
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

function LanguageEntryItem({ setCurrentTab }: { setCurrentTab: Dispatch<SetStateAction<SettingsTab>> }) {
    const { i18n, t } = useTranslation()

    const { user, setUser } = useAuth()

    if (!user) return

    const [language, setLanguage] = useState<Language>(user.preferences.language || "")

    const languages: Language[] = ["", "English", "Português"]
    const autoDetect = t("settings.autoDetect")

    async function handleChangeLanguage(language: Language) {
        me(language)
        setUser(previous => previous ? { ...previous, preferences: { ...previous.preferences, language } } : previous)
        setLanguage(language)
        await i18n.changeLanguage(getLanguageAbbreviation(language))
        setCurrentTab("settings.general")
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
                <Select.Content className="z-10 rounded-lg text-white light:text-black bg-gray-900 light:bg-gray-100">
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
    const { t } = useTranslation()

    const { setChats } = useChat()
    const notify = useNotify()

    async function handleDeleteChats() {
        const response = await deleteChats()
        if (response.ok) {
            if (location.pathname.includes("chat")) {
                location.href = "/"
            } else {
                setChats([])
            }
        } else {
            notify(t("dialogs.deleteChats.error"), "error")
        }
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

function LogoutEntryItem() {
    const { t } = useTranslation()

    async function handleLogout() {
        await logout()
        location.href = "/login"
    }

    return (
        <button className={entryClasses} onClick={handleLogout}>
            {t("settings.logout")}
        </button>
    )
}

function SessionsEntryItem() {
    const { t } = useTranslation()

    const { user } = useAuth()

    async function handleLogoutAllSessions() {
        await logoutAllSessions()
        location.href = "/login"
    }

    if (!user) return

    return (
        <div className="flex flex-col gap-1 my-2 rounded-lg py-1 border border-gray-500">
            <h3 className="px-2 pb-1 text-lg font-semibold border-b border-gray-500">
                {t("settings.sessions.title")}
            </h3>
            <div className="flex flex-col max-h-100 gap-1 px-2 py-1 overflow-y-auto">
                {user.sessions.length === 0 ? (
                    <p>{t("settings.sessions.noActiveSessions")}</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        <button className={entryClasses} onClick={handleLogoutAllSessions}>
                            {t("settings.sessions.logoutAll")}
                        </button>
                        {user.sessions.map((s, i) => (
                            <div key={i} className="flex flex-col p-2 border border-gray-500 rounded-lg">
                                {s.logout_at === null && <p className="text-sm text-green-500">{t("settings.sessions.activeSession")}</p>}
                                <p><strong>{t("settings.sessions.login")}:</strong> {new Date(s.login_at).toLocaleString()}</p>
                                {s.logout_at !== null &&
                                    <p><strong>{t("settings.sessions.logout")}:</strong> {new Date(s.logout_at).toLocaleString()}</p>
                                }
                                <p><strong>{t("settings.sessions.ipAddress")}:</strong> {s.ip_address}</p>
                                <p><strong>{t("settings.sessions.browser")}:</strong> {s.browser}</p>
                                <p><strong>{t("settings.sessions.os")}:</strong> {s.os}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function Entry({ name, item }: { name: string, item: ReactNode }) {
    return (
        <div className="flex py-2 items-center justify-between">
            <label>{name}</label>
            {item}
        </div>
    )
}

type SettingsTab =
    | "settings.general"
    | "settings.customizations"
    | "settings.data"
    | "settings.security"
    | "settings.account"

const entryClasses = `
    flex px-2 py-1 items-center justify-center rounded-lg cursor-pointer
    border border-gray-500
    hover:bg-gray-700 light:hover:bg-gray-300
    focus:bg-gray-700 light:focus:bg-gray-300
`
const destructiveEntryClasses = entryClasses + " text-red-500"
const itemClasses = "flex items-center gap-4 px-2 py-1 rounded cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"