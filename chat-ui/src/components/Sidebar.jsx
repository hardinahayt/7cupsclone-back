import { Check, MessageSquare, Search, Settings, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ensureNotificationPermission } from '../hooks/useConversations';
import { RequestQueue } from './RequestQueue';

export function Sidebar({ conversations, activeConv, categories, selectConversation, setActiveConv }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [autoMode, setAutoMode] = useState(false);
    const [toggling, setToggling] = useState(false);

    useEffect(() => {
        // Fetch current autoMode status
        fetch(`${window.location.origin.replace('5173', '3000')}/auto-reply/status`)
            .then(res => res.json())
            .then(data => setAutoMode(!!data.autoMode))
            .catch(err => console.error('Failed to fetch autoMode status:', err));
    }, []);

    const toggleAutoMode = async () => {
        if (toggling) return;
        setToggling(true);
        try {
            const res = await fetch(`${window.location.origin.replace('5173', '3000')}/auto-reply/toggle-mode`, {
                method: 'POST'
            });
            const data = await res.json();
            setAutoMode(!!data.autoMode);
        } catch (err) {
            console.error('Failed to toggle autoMode:', err);
        } finally {
            setToggling(false);
        }
    };

    const filteredConversations = conversations.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const onlineFiltered = filteredConversations.filter(c => c.isOnline && !c.isGroup);
    const botFiltered = filteredConversations.filter(c => c.isBot);

    // Official IDs from the specialized request queue endpoint
    const pendingRequestIds = new Set((window.requestQueue?.requests || []).map(r => r.convID));

    // Private chats: include personal ones that are NOT in the pending queue
    const privateFiltered = filteredConversations.filter(c =>
        !c.isGroup && !c.isBot &&
        (c.reqType !== 'personal' || !pendingRequestIds.has(c.id))
    );

    const groupFiltered = filteredConversations.filter(c => c.isGroup);

    // Only show personal requests if they are actually in the official pending list
    const personalRequests = filteredConversations.filter(c =>
        c.reqType === 'personal' && pendingRequestIds.has(c.id)
    );

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-header-top">
                    <div className="sidebar-logo">
                        <MessageSquare size={24} className="sidebar-logo-icon" />
                        <span>7 CUPS</span>
                    </div>
                    <button
                        className={`auto-mode-toggle ${autoMode ? 'active' : ''}`}
                        onClick={toggleAutoMode}
                        disabled={toggling}
                        title={autoMode ? "Auto-Mode is ON (Accepting + AI)" : "Auto-Mode is OFF"}
                    >
                        <div className="toggle-dot"></div>
                        <span>AUTO</span>
                    </button>
                </div>
                <div className="sidebar-search-container">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="sidebar-search-input"
                    />
                    {searchQuery && (
                        <X
                            size={14}
                            className="clear-search"
                            onClick={() => setSearchQuery('')}
                        />
                    )}
                </div>
            </div>

            <div className="sidebar-content">
                {/* General Request Queue (Passed from top-level) */}
                {window.requestQueue && (
                    <RequestQueue
                        requests={window.requestQueue.requests}
                        onAccept={window.requestQueue.acceptRequest}
                        loading={window.requestQueue.loading}
                    />
                )}

                {/* Personal Requests */}
                {personalRequests.length > 0 && (
                    <div className="sidebar-section personal-requests-section">
                        <div className="sidebar-section-title">Personal Requests</div>
                        {personalRequests.map(conv => (
                            <div key={conv.id} className="sidebar-item personal-request-item">
                                <div className="avatar-container">
                                    {conv.imgURL
                                        ? <img src={conv.imgURL} className="conv-avatar" alt="" />
                                        : <User size={18} />
                                    }
                                </div>
                                <div className="sidebar-item-body">
                                    <div className="sidebar-item-top">
                                        <span className="sidebar-item-label">{conv.name}</span>
                                    </div>
                                    <div className="sidebar-item-preview">Wants to talk to you!</div>
                                </div>
                                <button
                                    className="accept-btn secondary"
                                    onClick={() => window.requestQueue?.acceptRequest(conv.id)}
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Online Now */}
                {onlineFiltered.length > 0 && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Online Now</div>
                        <div className="online-now-list">
                            {onlineFiltered.map(conv => (
                                <div key={conv.id} className="online-now-item" onClick={() => selectConversation(conv)} title={conv.name}>
                                    <div className="avatar-container">
                                        {conv.imgURL ? (
                                            <img src={conv.imgURL} className="conv-avatar" alt="" />
                                        ) : (
                                            <div className="avatar-placeholder"><User size={18} /></div>
                                        )}
                                        <span className={`status-dot ${conv.isOnline ? 'active' : ''}`}></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Explore */}
                <div className="sidebar-section">
                    <div className="sidebar-section-title">Explore</div>
                    <div className="sidebar-item" onClick={() => {
                        ensureNotificationPermission();
                        setActiveConv({ id: 'browse', name: 'Browse Listeners' });
                    }}>
                        <Search size={18} />
                        <span className="sidebar-item-label">Browse Listeners</span>
                    </div>
                </div>

                {/* Noni */}
                {botFiltered.length > 0 && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Noni</div>
                        {botFiltered.map(conv => (
                            <div key={conv.id} onClick={() => selectConversation(conv)} className={`sidebar-item ${activeConv?.id === conv.id ? 'active' : ''}`}>
                                <div className="avatar-container">
                                    {conv.imgURL
                                        ? <img src={conv.imgURL} className="conv-avatar" alt="" />
                                        : <MessageSquare size={18} style={{ marginTop: '3px' }} className={activeConv?.id === conv.id ? 'sidebar-logo-icon' : ''} />
                                    }
                                    <span className={`status-dot ${conv.isOnline ? 'active' : ''}`}></span>
                                </div>
                                <div className="sidebar-item-body">
                                    <div className="sidebar-item-top">
                                        <span className="sidebar-item-label">{conv.name}</span>
                                        {conv.unreadCount > 0 && activeConv?.id !== conv.id && (
                                            <span className="unread-badge">{conv.unreadCount}</span>
                                        )}
                                    </div>
                                    {conv.lastMsg && <div className="sidebar-item-preview">{conv.lastMsg}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Private Conversations */}
                {privateFiltered.length > 0 && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Conversations</div>
                        {privateFiltered.map(conv => (
                            <div key={conv.id} onClick={() => selectConversation(conv)} className={`sidebar-item ${activeConv?.id === conv.id ? 'active' : ''}`}>
                                <div className="avatar-container">
                                    {conv.imgURL
                                        ? <img src={conv.imgURL} className="conv-avatar" alt="" />
                                        : <MessageSquare size={14} style={{ marginTop: '3px' }} className={activeConv?.id === conv.id ? 'sidebar-logo-icon' : ''} />
                                    }
                                    <span className={`status-dot ${conv.isOnline ? 'active' : ''}`}></span>
                                </div>
                                <div className="sidebar-item-body">
                                    <div className="sidebar-item-top">
                                        <span className="sidebar-item-label">{conv.name}</span>
                                        {conv.unreadCount > 0 && activeConv?.id !== conv.id && (
                                            <span className="unread-badge">{conv.unreadCount}</span>
                                        )}
                                    </div>
                                    {conv.lastMsg && <div className="sidebar-item-preview">{conv.lastMsg}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Groups */}
                {groupFiltered.length > 0 && (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Groups</div>
                        {groupFiltered.map(conv => (
                            <div key={conv.id} onClick={() => selectConversation(conv)}>
                                {conv.imgURL
                                    ? <img src={conv.imgURL} className="conv-avatar" alt="" />
                                    : <MessageSquare size={14} style={{ marginTop: '3px' }} className={activeConv?.id === conv.id ? 'sidebar-logo-icon' : ''} />
                                }
                                <div className="sidebar-item-body">
                                    <div className="sidebar-item-top">
                                        <span className="sidebar-item-label">{conv.name}</span>
                                    </div>
                                    {conv.lastMsg && <div className="sidebar-item-preview">{conv.lastMsg}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Category Tags */}
                <div className="sidebar-tags">
                    {categories.slice(0, 10).map(cat => (
                        <span key={cat.catID} className="tag">{cat.catName}</span>
                    ))}
                </div>
            </div>

            <div className="sidebar-footer">
                <div className="user-status">
                    <User size={16} />
                    <span className="user-status-text">SESSION ACTIVE</span>
                </div>
                <Settings size={14} className="action-btn" />
            </div>
        </aside>
    );
}
