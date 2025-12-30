import { t } from "i18next"
import { useParams } from "react-router"

export default function Introduction() {
    const { chatUUID } = useParams()

    return (
        <h1
            className={`
                mb-5 text-3xl font-semibold text-center transition-all duration-500
                ${chatUUID ? "fixed opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}
            `}
        >
            {t("chat.header")}
        </h1>
    )
}