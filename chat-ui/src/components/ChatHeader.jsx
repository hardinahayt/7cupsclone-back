import { Bot, Info, MoreHorizontal, RefreshCw, User } from 'lucide-react';

export function ChatHeader({ activeConv, loading, fetchData, onAvatarClick, autoReplyEnabled, toggleAutoReply }) {
    return (
        <header className="chat-header">
            <div className="chat-header-title" onClick={(e) => {
                if (activeConv?.id !== 'browse') {
                    e.stopPropagation();
                    onAvatarClick();
                }
            }}>
                <div className="avatar-container" style={{ cursor: 'pointer' }}>
                    {activeConv?.imgURL ? (
                        <img src={activeConv.imgURL} className="header-avatar" alt="" />
                    ) : (
                        <div className="avatar-placeholder header-avatar"><User size={24} /></div>
                    )}
                    <span className={`status-dot-pulse ${activeConv?.isOnline ? 'status-dot-green' : 'status-dot-grey'}`}></span>
                </div>
                <h2 className="chat-header-name" style={{ cursor: 'pointer' }}>
                    {activeConv?.name || '...'}
                </h2>
            </div>

            <div className="chat-header-actions">
                {activeConv && activeConv.id !== 'browse' && (
                    <button
                        className={`action-btn-bot ${autoReplyEnabled ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleAutoReply(); }}
                        title={autoReplyEnabled ? "Auto-Reply ON" : "Auto-Reply OFF"}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: autoReplyEnabled ? 'var(--accent)' : 'inherit',
                            transition: 'all 0.2s',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Bot size={18} className={autoReplyEnabled ? 'pulse-slow' : ''} />
                    </button>
                )}
                <div className="action-divider" />
                <RefreshCw
                    size={18}
                    className={`action-btn ${loading ? 'action-spin' : ''}`}
                    onClick={(e) => { e.stopPropagation(); fetchData(); }}
                />
                <div className="action-divider" />
                <Info size={18} className="action-btn" />
                <MoreHorizontal size={18} className="action-btn" />
            </div>
        </header>
    );
}
