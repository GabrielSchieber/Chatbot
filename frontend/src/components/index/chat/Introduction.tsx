import { t } from "i18next"
import type React from "react"
import { useParams } from "react-router"

export default function Introduction({ ref }: { ref: React.RefObject<HTMLHeadingElement | null> }) {
    const { chatUUID } = useParams()

    return (
        <h1
            ref={ref}
            className={`
                fixed mb-5 text-3xl font-semibold text-center transition-opacity duration-500
                ${chatUUID ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}
            `}
        >
            {t("chat.header")}
        </h1>
    )
}