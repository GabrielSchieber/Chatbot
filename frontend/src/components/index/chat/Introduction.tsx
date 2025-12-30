import { t } from "i18next"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { useParams } from "react-router"

export default function Introduction() {
    const { chatUUID } = useParams()

    const [shouldFade, setShouldFade] = useState(chatUUID !== undefined)

    useEffect(() => {
        if (chatUUID) {
            setShouldFade(true)
        }
    }, [chatUUID])

    return (
        <motion.h1
            layout
            initial={{ opacity: shouldFade ? 0 : 100 }}
            animate={{ opacity: shouldFade ? 0 : 100 }}
            transition={{
                type: "tween",
                ease: "easeInOut",
                duration: 0.5
            }}
            className="
                text-3xl font-semibold text-center
                absolute -mt-20 w-full top-1/2 right-1/2 translate-x-1/2 translate-y-1/2
            "
        >
            {t("chat.header")}
        </motion.h1>
    )
}