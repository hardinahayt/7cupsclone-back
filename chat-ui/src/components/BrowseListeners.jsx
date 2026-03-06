import { MessageSquare, Radio, Send, X } from 'lucide-react';

export function BrowseListeners({
    listeners, browseLoading,
    browseGender, setBrowseGender,
    browseCountry, setBrowseCountry,
    page, setPage,
    chatInitiating,
    fetchListeners,
    handleStartChat,
    // Broadcast props
    broadcastMsg, setBroadcastMsg,
    broadcasting,
    broadcastProgress,
    showBroadcastModal, setShowBroadcastModal,
    startBroadcast,
}) {
    const broadcastDone = broadcastProgress.done;
    const broadcastTotal = broadcastProgress.total;
    const pct = broadcastTotal > 0 ? Math.round((broadcastDone / broadcastTotal) * 100) : 0;

    return (
        <div className="chat-log-inner">
            {/* Header Row */}
            <div className="browse-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 className="browse-title">Available Listeners</h2>
                    {!browseLoading && listeners.length > 0 && (
                        <span style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: 0.5
                        }}>{listeners.length} loaded</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="browse-filters">
                        <select value={browseGender} onChange={e => setBrowseGender(e.target.value)} className="custom-chat-input filter-select">
                            <option value="">Any Gender</option>
                            <option value="F">Female</option>
                            <option value="M">Male</option>
                        </select>
                        <select value={browseCountry} onChange={e => setBrowseCountry(e.target.value)} className="custom-chat-input filter-select">
                            <option value="">Any Country</option>
                            <option value="US">United States</option>
                            <option value="GB">United Kingdom</option>
                            <option value="CA">Canada</option>
                            <option value="IN">India</option>
                            <option value="AU">Australia</option>
                        </select>
                    </div>
                    {listeners.length > 0 && (
                        <button
                            className="chat-now-btn"
                            style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                            onClick={() => setShowBroadcastModal(true)}
                            disabled={broadcasting}
                        >
                            <Radio size={14} />
                            Broadcast Message
                        </button>
                    )}
                </div>
            </div>

            {/* Listener Grid */}
            <div className={`browse-grid ${browseLoading ? 'grid-loading' : ''}`}>
                {listeners.map((l, i) => (
                    <div key={l.listID || i} className="listener-card">
                        <div className="listener-avatar-section">
                            <div className="listener-avatar-img" style={{ backgroundImage: `url(${l.image || l.imgURL})` }} />
                            {l.CountryFlag && <img src={l.CountryFlag} alt={l.CountryFull} className="listener-flag" />}
                            <div className="listener-status-dot" />
                        </div>
                        <div className="listener-info-section">
                            <h3 className="listener-name">
                                {l.screenName}
                                {l.hasBadge441 === 1 && <span className="verified-badge">✓</span>}
                            </h3>
                            <p className="listener-level">{l.listenerLevel || 'Listener'}</p>
                            <div className="listener-meta">
                                <MessageSquare size={12} className="meta-icon" /> {l.numConversations || '?'}
                            </div>
                            <div className="listener-bio clamp-two-lines" dangerouslySetInnerHTML={{ __html: l.bio || l.textBio || '' }} />
                        </div>
                        <div className="listener-card-footer">
                            <button
                                className={`chat-now-btn ${chatInitiating === (l.listID || l.userID) ? 'loading' : ''}`}
                                onClick={() => handleStartChat(l)}
                                disabled={browseLoading || chatInitiating !== null}
                            >
                                {chatInitiating === (l.listID || l.userID)
                                    ? <span className="btn-spinner">Starting Chat...</span>
                                    : <>Chat Now</>
                                }
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Skeleton Loader */}
            {browseLoading && (
                <div className="browse-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="skeleton-card">
                            <div className="skeleton-avatar" />
                            <div className="skeleton-text-group">
                                <div className="skeleton-text-1" />
                                <div className="skeleton-text-2" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Load More (next 5 pages at once) */}
            {!browseLoading && listeners.length > 0 && (
                <div className="browse-load-more">
                    <button
                        className="auth-btn custom-login-btn"
                        onClick={() => {
                            const nextStart = page + 1;
                            setPage(nextStart + 4);
                            fetchListeners(nextStart, 5);
                        }}
                    >
                        Load More
                    </button>
                </div>
            )}

            {/* ── Broadcast Modal ── */}
            {showBroadcastModal && (
                <div className="profile-modal-overlay" onClick={() => !broadcasting && setShowBroadcastModal(false)}>
                    <div className="profile-modal-card" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                        {!broadcasting && (
                            <button className="modal-close" onClick={() => setShowBroadcastModal(false)}><X size={16} /></button>
                        )}
                        <div style={{ padding: '8px 4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <Radio size={22} color="#7c3aed" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Broadcast Message</h3>
                                    <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
                                        Will be sent to <strong>{listeners.length}</strong> listeners
                                    </p>
                                </div>
                            </div>

                            {!broadcasting ? (
                                <>
                                    <textarea
                                        className="custom-chat-input"
                                        placeholder="Type your message here..."
                                        value={broadcastMsg}
                                        onChange={e => setBroadcastMsg(e.target.value)}
                                        rows={4}
                                        style={{ width: '100%', resize: 'vertical', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }}
                                    />
                                    <button
                                        className="chat-now-btn"
                                        disabled={!broadcastMsg.trim()}
                                        onClick={startBroadcast}
                                        style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', padding: '10px', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                    >
                                        <Send size={16} /> Send to All {listeners.length} Listeners
                                    </button>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                    {/* Progress Bar */}
                                    <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
                                        Sending... {broadcastDone} / {broadcastTotal}
                                        {broadcastProgress.errors > 0 && ` (${broadcastProgress.errors} failed)`}
                                    </div>
                                    <div style={{ background: 'var(--border)', borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 12 }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            background: broadcastProgress.errors > 0
                                                ? 'linear-gradient(135deg,#ef4444,#f97316)'
                                                : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                                            transition: 'width 0.3s ease',
                                            borderRadius: 8
                                        }} />
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: '#7c3aed' }}>{pct}%</div>
                                    {broadcastDone === broadcastTotal && (
                                        <div style={{ marginTop: 12 }}>
                                            <p style={{ color: '#22c55e', fontWeight: 700, margin: '4px 0' }}>
                                                ✅ Broadcast Complete! {broadcastDone - broadcastProgress.errors} sent successfully.
                                            </p>
                                            <button
                                                className="chat-now-btn"
                                                onClick={() => setShowBroadcastModal(false)}
                                                style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Close
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
