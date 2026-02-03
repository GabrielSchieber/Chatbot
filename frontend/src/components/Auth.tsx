import { Label as RadixLabel } from "radix-ui"
import { type Dispatch, type ReactNode, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"

export type Step = "login" | "mfa" | "mfa-recovery"

export function Form({ children, handleSubmit }: { children: ReactNode, handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 light:bg-zinc-50">
            <form className="w-full max-w-md p-8 space-y-6 rounded-2xl border border-zinc-800 light:border-zinc-200 shadow-2xl bg-zinc-900 light:bg-white" onSubmit={handleSubmit}>
                {children}
            </form>
        </div>
    )
}

export function Header({ text }: { text: string }) {
    return <h1 className="text-2xl font-bold text-center text-zinc-100 light:text-zinc-900">{text}</h1>
}

export function Email({ email, setEmail }: { email: string, setEmail: Dispatch<SetStateAction<string>> }) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col space-y-2">
            <Label htmlFor="email" text={t("auth.email.label")} />
            <input
                id="email"
                type="email"
                placeholder={t("auth.email.placeholder")}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClassName}
                autoFocus
                required
            />
        </div>
    )
}

export function Password({ password, setPassword, label, id, minLength, maxLength, includeForgotPassword = false }: {
    password: string
    setPassword: Dispatch<SetStateAction<string>>
    label: string
    id?: string
    minLength?: number
    maxLength?: number
    includeForgotPassword?: boolean
}) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col space-y-2">
            <Label htmlFor={id} text={label} />
            <input
                id={id}
                type="password"
                minLength={minLength}
                maxLength={maxLength}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClassName}
                required
            />
            {includeForgotPassword &&
                <a
                    className="text-zinc-400 light:text-zinc-500 hover:underline"
                    href="/forgot-password"
                >
                    {t("auth.password.forgot")}
                </a>
            }
        </div>
    )
}

export function MFA({ code, setCode, setError }: {
    code: string
    setCode: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string>>
}) {
    const { t } = useTranslation()

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCode(e.target.value)
        setError("")
    }

    return (
        <div className="flex flex-col space-y-2">
            <Label htmlFor="code" text={t("auth.mfa.label")} />
            <input
                id="code"
                type="text"
                maxLength={6}
                value={code}
                placeholder={t("auth.mfa.placeholder")}
                onChange={handleChange}
                className={mfaInputClassName}
                required
            />
        </div>
    )
}

export function MFAStepSwitch({ text, switchStep, setStep, setCode, setError, isDisabled }: {
    text: string
    switchStep: Step
    setStep: Dispatch<SetStateAction<Step>>
    setCode: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string>>
    isDisabled: boolean
}) {
    function handleClick(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.preventDefault()
        setStep(switchStep)
        setCode("")
        setError("")
    }

    return (
        <button
            className="
                w-full text-center text-zinc-400 light:text-zinc-500 cursor-pointer
                disabled:cursor-not-allowed enabled:hover:underline disabled:text-zinc-600 light:disabled:text-zinc-400
            "
            onClick={handleClick}
            disabled={isDisabled}
        >
            {text}
        </button>
    )
}

export function MFARecovery({ code, setCode, setError }: {
    code: string
    setCode: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string>>
}) {
    const { t } = useTranslation()

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCode(e.target.value)
        setError("")
    }

    return (
        <div className="flex flex-col space-y-2">
            <Label htmlFor="code" text={t("auth.mfaRecovery.label")} />
            <input
                id="code"
                type="text"
                maxLength={12}
                value={code}
                placeholder={t("auth.mfaRecovery.placeholder")}
                onChange={handleChange}
                className={mfaInputClassName}
                required
            />
        </div>
    )
}

export function Error({ text }: { text: string }) {
    return <p className="text-sm text-red-400 light:text-red-600">{text}</p>
}

export function Button({ text, isDisabled, onClick }: { text: string, isDisabled: boolean, onClick?: VoidFunction }) {
    return (
        <button
            className="
                w-full px-4 py-2 font-medium rounded-xl cursor-pointer
                text-zinc-900 bg-zinc-100 hover:bg-zinc-200
                light:text-zinc-100 light:bg-zinc-900 light:hover:bg-zinc-800
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-zinc-500
            "
            type={onClick === undefined ? "submit" : "button"}
            onClick={onClick}
            disabled={isDisabled}
        >
            {text}
        </button>
    )
}

export function Recommendation({ text, url, urlText }: { text: string, url: string, urlText: string }) {
    return (
        <p className="text-center text-zinc-400 light:text-zinc-500">
            {text}{" "}
            <a href={url} className="text-zinc-200 light:text-zinc-800 hover:underline">
                {urlText}
            </a>
        </p>
    )
}

function Label({ htmlFor, text }: { htmlFor?: string, text: string }) {
    return (
        <RadixLabel.Root htmlFor={htmlFor} className="text-sm font-medium text-zinc-200 light:text-zinc-700">
            {text}
        </RadixLabel.Root>
    )
}

const inputClassName = `
    w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2
    focus:ring-zinc-500 bg-zinc-950 text-zinc-100 border-zinc-800
    light:bg-zinc-50 light:text-zinc-900 light:border-zinc-300
`

const mfaInputClassName = `
    tracking-widest text-center w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2
    focus:ring-zinc-500 bg-zinc-950 text-zinc-100 border-zinc-800
    light:bg-zinc-50 light:text-zinc-900 light:border-zinc-300
`