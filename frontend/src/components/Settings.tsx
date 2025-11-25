import { CheckIcon, ChevronDownIcon, Cross1Icon, EnvelopeClosedIcon, GearIcon, LockClosedIcon, MixerHorizontalIcon, MixerVerticalIcon, PersonIcon } from "@radix-ui/react-icons"
import { Dialog, Select, Tabs } from "radix-ui"
import { useState, type ReactNode, type SetStateAction, type Dispatch, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { ArchivedChatsDialog } from "./ArchivedChatsDialog"
import ConfirmDialog from "./ConfirmDialog"
import Customizations from "./Customizations"
import DeleteAccountDialog from "./DeleteAccountDialog"
import MFADialog from "./MFADialog"
import { useAuth } from "../providers/AuthProvider"
import { useChat } from "../providers/ChatProvider"
import { deleteChats, logout, me } from "../utils/api"
import { applyTheme, getLanguageAbbreviation } from "../utils/misc"
import type { Language, Theme } from "../utils/types"

export default function Settings({ isSidebarOpen, itemClassNames }: { isSidebarOpen: boolean, itemClassNames: string }) {
    const { user } = useAuth()
    const { isMobile } = useChat()
    const { t } = useTranslation()

    const [currentTab, setCurrentTab] = useState(t("settings.general"))

    const [isScreenHeightSmall, setIsScreenHeightSmall] = useState(window.innerHeight < 430)

    useEffect(() => {
        const onResize = () => setIsScreenHeightSmall(window.innerHeight < 430)
        window.addEventListener("resize", onResize)
        return () => window.removeEventListener("resize", onResize)
    }, [])

    return (
        <Dialog.Root>
            <Dialog.Trigger className={itemClassNames}>
                <GearIcon className="size-5" /> {isSidebarOpen && t("sidebar.settings")}
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Title hidden>{t("sidebar.settings")}</Dialog.Title>
                <Dialog.Description hidden>{t("sidebar.settings")}</Dialog.Description>

                <Dialog.Content>
                    <Tabs.Root
                        className={`
                            fixed flex top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 text-white light:text-black
                            ${isMobile ? "flex-col inset-0 size-full" : isScreenHeightSmall ? "inset-0 w-150 h-full" : "w-150 min-h-105"}
                        `}
                        value={currentTab}
                        onValueChange={v => setCurrentTab(v)}
                    >
                        <Tabs.List
                            className={`
                                flex gap-1 p-4 items-start bg-gray-900 light:bg-gray-100
                                ${isMobile ? "flex-row flex-wrap" : "flex-col"}
                                ${!isMobile && !isScreenHeightSmall && "rounded-l-xl"}
                            `}
                        >
                            <Dialog.Close className={"ml-1 p-1.5 rounded-full cursor-pointer hover:bg-gray-700 light:hover:bg-gray-300"} data-testid="close-settings">
                                <Cross1Icon className="size-5" />
                            </Dialog.Close>

                            <Trigger icon={<GearIcon className="size-4.5" />} title={t("settings.general")} />
                            <Trigger icon={<MixerVerticalIcon className="size-4.5" />} title={t("settings.customizations")} />
                            <Trigger icon={<MixerHorizontalIcon className="size-4.5" />} title={t("settings.data")} />
                            <Trigger icon={<LockClosedIcon className="size-4.5" />} title={t("settings.security")} />
                            <Trigger icon={<PersonIcon className="size-4.5" />} title={t("settings.account")} />
                        </Tabs.List>

                        <Content title={t("settings.general")} isScreenHeightSmall={isScreenHeightSmall}>
                            <Entry name={t("settings.theme")} item={<ThemeEntryItem />} />
                            <Entry name={t("settings.language")} item={<LanguageEntryItem setCurrentTab={setCurrentTab} />} />
                        </Content>

                        <Content title={t("settings.customizations")} isScreenHeightSmall={isScreenHeightSmall}>
                            <Customizations />
                        </Content>

                        <Content title={t("settings.data")} isScreenHeightSmall={isScreenHeightSmall}>
                            <Entry name={t("settings.archivedChats")} item={<ArchivedChatsDialog triggerClassName={entryClasses} />} />
                            <Entry name={t("settings.deleteChats")} item={<DeleteChatsEntryItem />} />
                        </Content>

                        <Content title={t("settings.security")} isScreenHeightSmall={isScreenHeightSmall}>
                            <Entry name={t("settings.mfa")} item={<MFADialog triggerClassName={entryClasses} />} />
                            <Entry name={t("settings.logout")} item={<LogoutEntryItem />} />
                        </Content>

                        <Content title={t("settings.account")} isScreenHeightSmall={isScreenHeightSmall}>
                            {user && (
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

function Trigger({ icon, title }: { icon: ReactNode, title: string }) {
    const { isMobile } = useChat()

    return (
        <Tabs.Trigger
            value={title}
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

function Content({ title, isScreenHeightSmall, children }: { title: string, isScreenHeightSmall: boolean, children: ReactNode }) {
    const { isMobile } = useChat()

    return (
        <Tabs.Content
            value={title}
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
                <Select.Content className="rounded-lg text-white light:text-black bg-gray-900 light:bg-gray-100">
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

function LanguageEntryItem({ setCurrentTab }: { setCurrentTab: Dispatch<SetStateAction<string>> }) {
    const { user, setUser } = useAuth()
    const { i18n, t } = useTranslation()

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
                <Select.Content className="rounded-lg text-white light:text-black bg-gray-900 light:bg-gray-100">
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
    const { t } = useTranslation()

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

function LogoutEntryItem() {
    const { t } = useTranslation()

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
        <div className="flex py-2 items-center justify-between">
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