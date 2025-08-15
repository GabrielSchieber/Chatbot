import type { ReactNode } from "react"
import type { Message, Model, UIAttachment } from "../../types"

interface ChatProps {
    hasChatBegun: boolean
    messages: Message[]
    visibleFiles: UIAttachment[]
    input: string
    model: Model
    getHTMLMessage: (message: Message, index: number) => ReactNode
    handleRemoveAttachment: (id: string) => void
    setInput: (value: React.SetStateAction<string>) => void
    sendMessage: (event: React.KeyboardEvent<Element>) => void
    setModel: (value: React.SetStateAction<Model>) => void
    handleFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export default function Chat(
    {
        hasChatBegun,
        messages,
        visibleFiles,
        input,
        model,
        getHTMLMessage,
        handleRemoveAttachment,
        setInput,
        sendMessage,
        setModel,
        handleFilesChange
    }: ChatProps
) {
    return (
        <div id="chat-div">
            <div id="messages-div" className={hasChatBegun ? "expanded" : ""}>{messages.map((message, index) => getHTMLMessage(message, index))}</div>
            {hasChatBegun === false && <h1 id="new-chat-h1">Ask me anything</h1>}
            {visibleFiles.length > 0 && (
                <div className="attachment-items-div">
                    <div className="attachment-items-div">
                        {visibleFiles.map(attachment => (
                            <div key={attachment.id} className={`attachment-item-div ${attachment.isRemoving ? "removing" : ""}`}>
                                <button className="attachment-remove-button" onClick={() => handleRemoveAttachment(attachment.id)}>X</button>
                                <h1 className="attachment-icon-h1">Text</h1>
                                <div className="attachment-info-div">
                                    <>
                                        <h1 className="attachment-file-h1">{attachment.file.name}</h1>
                                        <p className="attachment-type-p">
                                            {attachment.file.name.endsWith(".txt")
                                                ? "Text"
                                                : attachment.file.name.endsWith(".md")
                                                    ? "Markdown"
                                                    : "File"}
                                        </p>
                                    </>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div id="prompt-div">
                <textarea id="prompt-textarea" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => sendMessage(event)} placeholder="Type here..."></textarea>
                <div id="prompt-footer-div">
                    <select id="model-select" value={model} onChange={event => setModel(event.target.value as Model)}>
                        <option value="SmolLM2-135M" className="model-select-option">SmolLM2-135M</option>
                        <option value="SmolLM2-360M" className="model-select-option">SmolLM2-360M</option>
                        <option value="SmolLM2-1.7B" className="model-select-option">SmolLM2-1.7B</option>
                    </select>
                    <div id="attachment-div">
                        <label id="attachment-label" htmlFor="attachment-input">📎</label>
                        <input id="attachment-input" type="file" onChange={handleFilesChange} multiple />
                    </div>
                </div>
            </div>
        </div>
    )
}