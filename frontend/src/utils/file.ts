export function getFileType(name: string) {
    const fileTypes = new Map(
        [
            [".txt", "Text"], [".md", "Markdown"], [".py", "Python"], [".js", "JavaScript"], [".png", "Image"],
            [".jpg", "Image"], [".jpeg", "Image"], [".gif", "Image"], [".pdf", "PDF"], [".docx", "Word Document"],
            [".xlsx", "Excel Spreadsheet"], [".pptx", "PowerPoint Presentation"], [".zip", "ZIP Archive"], [".rar", "RAR Archive"],
            [".7z", "7z Archive"], [".csv", "CSV"], [".json", "JSON"], [".xml", "XML"], [".html", "HTML"], [".css", "CSS"]
        ]
    )
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