import type { Language, Theme } from "../utils/types"

export function applyTheme(theme: Theme) {
    const root = document.documentElement

    root.classList.remove("Light", "Dark")

    if (theme === "System") {
        root.classList.add(matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light")
    } else {
        root.classList.add(theme)
    }
}

export function getFileTypeTranslationKey(name: string) {
    const fileTypes = new Map([
        [".txt", "utils.fileType.text"], ...[".png", ".jpg", ".jpeg", ".gif"].map<[string, string]>(e => [e, "utils.fileType.image"]),
        [".docx", "utils.fileType.wordDocument"], [".xlsx", "utils.fileType.excelSpreadsheet"], [".pptx", "utils.fileType.powerPointPresentation"],
        [".zip", "utils.fileType.zipArchive"], [".rar", "utils.fileType.rarArchive"], [".7z", "utils.fileType.7zArchive"],
        [".md", "Markdown"], [".py", "Python"], [".js", "JavaScript"], [".pdf", "PDF"],
        [".csv", "CSV"], [".json", "JSON"], [".xml", "XML"], [".html", "HTML"], [".css", "CSS"]
    ])

    for (const fileType of fileTypes) {
        if (name.endsWith(fileType[0])) {
            return fileType[1]
        }
    }

    return "utils.fileType.file"
}

export function getFileSize(size: number): string {
    if (size < 1_000) {
        return size + " B"
    } else if (size < 1_000_000) {
        return (size / 1_000).toFixed(2) + " KB"
    } else {
        return (size / 1_000_000).toFixed(2) + " MB"
    }
}

export function getLanguageAbbreviation(language: Language) {
    switch (language) {
        case "English": return "en"
        case "Português": return "pt"
    }
}