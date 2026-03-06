import { Check, User } from 'lucide-react';

export function RequestQueue({ requests, onAccept, loading }) {
    if (requests.length === 0) return null;

    return (
        <div className="sidebar-section request-queue-section">
            <div className="sidebar-section-title">Request Queue ({requests.length})</div>
            <div className="request-list">
                {requests.map((req) => (
                    <div key={req.convID} className="request-item">
                        <div className="avatar-container">
                            {req.imgURL ? (
                                <img src={req.imgURL} className="conv-avatar small" alt="" />
                            ) : (
                                <div className="avatar-placeholder small"><User size={14} /></div>
                            )}
                        </div>
                        <div className="request-info">
                            <span className="request-name">{req.userScreenName}</span>
                            <span className="request-meta">{req.reqLanguage} • {req.reqAge}</span>
                        </div>
                        <button
                            className="accept-btn"
                            onClick={() => onAccept(req.convID)}
                            title="Accept Request"
                        >
                            <Check size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
