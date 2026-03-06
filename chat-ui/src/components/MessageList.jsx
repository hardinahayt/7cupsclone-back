import moment from 'moment';

export function MessageList({ messages, isTyping, activeConvName, messagesEndRef, messageListRef }) {
    return (
        <div className="chat-log-inner" ref={messageListRef}>
            {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.sender === 'me' ? 'mine' : 'other'}`}>
                    <div className={`msg-bubble ${msg.sender === 'me' ? 'msg-mine' : 'msg-other'}`}>
                        {msg.text}
                    </div>
                    <span className="msg-time">
                        {(() => {
                            try {
                                const ts = msg.timestamp;
                                if (!ts) return '';
                                const m = typeof ts === 'number'
                                    ? moment(ts * (ts < 10000000000 ? 1000 : 1))
                                    : moment(ts);
                                return m.isValid() ? m.format('HH:mm') : '';
                            } catch { return ''; }
                        })()}
                    </span>
                </div>
            ))}

            {isTyping && (
                <div className="message-row other fade-in">
                    <div className="custom-typing-bubble">
                        <span className="custom-typing-dot" style={{ animationDelay: '0ms' }} />
                        <span className="custom-typing-dot" style={{ animationDelay: '150ms' }} />
                        <span className="custom-typing-dot" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="custom-typing-text">{activeConvName || 'User'} is typing...</span>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
}
