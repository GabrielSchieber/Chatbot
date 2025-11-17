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

export function getFileType(name: string) {
    const fileTypes = new Map([
        [".txt", "Text"], [".md", "Markdown"], [".py", "Python"], [".js", "JavaScript"], [".png", "Image"],
        [".jpg", "Image"], [".jpeg", "Image"], [".gif", "Image"], [".pdf", "PDF"], [".docx", "Word Document"],
        [".xlsx", "Excel Spreadsheet"], [".pptx", "PowerPoint Presentation"], [".zip", "ZIP Archive"], [".rar", "RAR Archive"],
        [".7z", "7z Archive"], [".csv", "CSV"], [".json", "JSON"], [".xml", "XML"], [".html", "HTML"], [".css", "CSS"]
    ])

    for (const fileType of fileTypes) {
        if (name.endsWith(fileType[0])) {
            return fileType[1]
        }
    }

    return "File"
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