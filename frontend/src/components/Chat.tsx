import { t } from "i18next"
import { useParams } from "react-router"

import Header from "./Header"
import Messages from "./Messages"
import Prompt from "./Prompt"

export const MAX_FILES = 10
export const MAX_FILE_SIZE = 5_000_000

export default function Chat() {
    const { chatUUID } = useParams()

    return (
        <div className="flex flex-col size-full items-center">
            <Header />
            <Messages />
            <h1
                className={`
                    text-3xl font-semibold text-center transition-opacity duration-300
                    ${chatUUID ? "fixed mt-25 top-0 bottom-0 translate-y-[35%] opacity-0 pointer-events-none" : "mb-5"}
                `}
            >
                {t("chat.header")}
            </h1>
            <Prompt />
        </div>
    )
}