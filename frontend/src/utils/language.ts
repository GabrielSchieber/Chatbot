import type { Language } from "../types"

export function getLanguageAbbreviation(language: Language) {
    switch (language) {
        case "English": return "en"
        case "Português": return "pt"
    }
}