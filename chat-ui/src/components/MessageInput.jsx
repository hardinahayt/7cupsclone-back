import { Search, Send, Wand2 } from 'lucide-react';

export function MessageInput({
    input, activeConv, handleInput, sendMessage,
    suggestReply, suggesting, messages
}) {
    const handleSuggest = async () => {
        if (!activeConv || suggesting) return;
        // Find last message from "other" side using the correct state properties
        const lastConv = [...messages].reverse().find(m => m.sender === 'other');
        const textToReplyTo = lastConv?.text || "Hi";

        // Map messages to AI role format for full context
        let history = messages.map(m => ({
            role: m.sender === 'me' ? 'assistant' : 'user',
            content: m.text || ''
        })).filter(h => h.content);

        // Ensure the last message (the one we want to reply to) is at the end of the history
        const lastInHistory = history[history.length - 1];
        if (textToReplyTo && (!lastInHistory || lastInHistory.content !== textToReplyTo)) {
            history.push({ role: 'user', content: textToReplyTo });
        }

        const suggestion = await suggestReply(activeConv.id, textToReplyTo, activeConv.name, history);
        if (suggestion) {
            // Fill the input box
            const e = { target: { value: suggestion } };
            handleInput(e);
        }
    };

    return (
        <div className="chat-input-area">
            <div className="chat-input-wrapper">
                <button
                    className={`suggest-btn ${suggesting ? 'loading' : ''}`}
                    onClick={handleSuggest}
                    disabled={suggesting || !activeConv || activeConv.id === 'browse'}
                    title="AI Suggest Reply"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: (suggesting || !activeConv) ? 'not-allowed' : 'pointer',
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: (!activeConv || activeConv.id === 'browse') ? 0.5 : 1
                    }}
                >
                    <Wand2 size={18} className={suggesting ? 'spin-slow' : ''} />
                </button>
                <div className="action-divider" />
                <Search size={18} className="action-btn" />
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(e); }} className="chat-form">
                    <input
                        type="text"
                        className="custom-chat-input"
                        placeholder={`Message ${activeConv?.name || '...'}`}
                        value={input}
                        onChange={handleInput}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        disabled={!activeConv || activeConv.id === 'browse'}
                    />

                    <button type="submit" disabled={!input.trim() || !activeConv} className="send-btn">
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}
