import { Label } from "radix-ui"
import type { Dispatch, ReactNode, SetStateAction } from "react"

export const formClassNames = "flex flex-col gap-3 p-4 items-center justify-center rounded-xl bg-gray-800 light:bg-gray-100"
export const inputClassNames = "w-full px-3 py-2 rounded-xl outline-none bg-gray-700 light:bg-gray-300"
export const buttonClassNames = `
    px-6 py-1 rounded-xl cursor-pointer bg-gray-700 light:bg-gray-300 hover:bg-gray-600
    light:hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed
`

export function Form({ children, handleSubmit }: { children: ReactNode, handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 light:bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 light:bg-white rounded-lg shadow-md">
                <form className="space-y-4" onSubmit={handleSubmit}>
                    {children}
                </form>
            </div>
        </div>
    )
}

export function Header({ text }: { text: string }) {
    return <h2 className="text-2xl font-bold text-center text-gray-100 light:text-gray-800">{text}</h2>
}

export function Email({ email, setEmail }: { email: string, setEmail: Dispatch<SetStateAction<string>> }) {
    return (
        <div className="flex flex-col space-y-2">
            <Label.Root htmlFor="email" className="text-sm font-medium text-gray-200 light:text-gray-700">
                Email
            </Label.Root>
            <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                    focus:ring-indigo-500 bg-gray-700 text-gray-100 light:bg-white light:text-gray-900
                "
                required
            />
        </div>
    )
}

export function Password({ password, setPassword, label, id, minLength, maxLength }: {
    password: string
    setPassword: Dispatch<SetStateAction<string>>
    label: string
    id?: string
    minLength?: number
    maxLength?: number
}) {
    return (
        <div className="flex flex-col space-y-2">
            <Label.Root htmlFor={id} className="text-sm font-medium text-gray-200 light:text-gray-700">
                {label}
            </Label.Root>
            <input
                id={id}
                type="password"
                minLength={minLength}
                maxLength={maxLength}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="
                    w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
                    focus:ring-indigo-500 bg-gray-700 text-gray-100 light:bg-white light:text-gray-900
                "
                required
            />
        </div>
    )
}

export function Error({ text }: { text: string }) {
    return <p className="text-sm text-red-400 light:text-red-600">{text}</p>
}

export function Button({ text }: { text: string }) {
    return (
        <button
            className="
                w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md
                cursor-pointer hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
            "
            type="submit"
        >
            {text}
        </button>
    )
}

export function Recommendation({ text, url, urlText }: { text: string, url: string, urlText: string }) {
    return (
        <p className="text-sm text-center text-gray-300 light:text-gray-600">
            {text}{" "}
            <a href={url} className="text-indigo-400 light:text-indigo-600 hover:underline">
                {urlText}
            </a>
        </p>
    )
}