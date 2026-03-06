import { Calendar, MessageSquare, RefreshCw, User } from 'lucide-react';

export function ProfileModal({ activeConv, profileLoading, onClose }) {
    if (!activeConv) return null;
    return (
        <div className="profile-modal-overlay" onClick={onClose}>
            <div className="profile-modal-card" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                {profileLoading ? (
                    <div className="modal-loading-state">
                        <RefreshCw size={40} className="action-spin" />
                        <p>Loading Profile...</p>
                    </div>
                ) : (
                    <div className="listener-card" style={{ margin: 0, border: 'none' }}>
                        <div className="listener-avatar-section">
                            <div className="listener-avatar-img" style={{ backgroundImage: `url(${activeConv.imgURL})` }} />
                            {activeConv.CountryFlag && <img src={activeConv.CountryFlag} alt="" className="listener-flag" />}
                        </div>
                        <div className="listener-info-section">
                            <h3 className="listener-name">{activeConv.name}</h3>
                            <p className="listener-level">{activeConv.memberLevel || activeConv.listenerLevel || 'User'}</p>

                            <div className="profile-identity-grid">
                                {(activeConv.gender || activeConv.age) && (
                                    <div className="profile-stat-pill" title="Gender, Age">
                                        <User size={12} />
                                        {activeConv.gender ? `${activeConv.gender}, ` : ''}
                                        {activeConv.age ? `Age ${activeConv.age}` : ''}
                                    </div>
                                )}
                                {(activeConv.countryFull || activeConv.country) && (
                                    <div className="profile-stat-pill" title="Country">
                                        {activeConv.CountryFlag && (
                                            <img src={activeConv.CountryFlag} alt="" style={{ width: 14, height: 10, marginRight: 4 }} />
                                        )}
                                        {activeConv.countryFull || activeConv.country}
                                    </div>
                                )}
                                {activeConv.language && (
                                    <div className="profile-stat-pill" title="Language">🌐 {activeConv.language}</div>
                                )}
                                {activeConv.lastActive && (
                                    <div className="profile-stat-pill" title="Last Active">🕐 {activeConv.lastActive}</div>
                                )}
                                {activeConv.overallRating && (
                                    <div className="profile-stat-pill" title="Rating">⭐ {activeConv.overallRating}</div>
                                )}
                                {activeConv.joinedDate && (
                                    <div className="profile-stat-pill" title="Date Joined">
                                        <Calendar size={12} /> Joined {activeConv.joinedDate}
                                    </div>
                                )}
                                <div className="profile-stat-pill" title="Growth Points">
                                    <RefreshCw size={12} /> {activeConv.points || '0'} pts
                                </div>
                                {activeConv.streak && (
                                    <div className="profile-stat-pill">🔥 {activeConv.streak} day streak</div>
                                )}
                                <div className="profile-stat-pill">
                                    <MessageSquare size={12} /> {activeConv.numConversations || '0'} chats
                                </div>
                            </div>

                            <div className="profile-section-label">Identity &amp; Experience</div>
                            <div className="profile-tags-container">
                                {activeConv.categories?.filter(c => c.livedExperience).map(cat => (
                                    <span key={cat.id} className="profile-tag lived">{cat.catName}</span>
                                ))}
                                {activeConv.categories?.filter(c => !c.livedExperience).map(cat => (
                                    <span key={cat.id} className="profile-tag">{cat.catName}</span>
                                ))}
                            </div>

                            <div className="profile-section-label">Bio</div>
                            <div
                                className="listener-bio profile-bio-expanded"
                                dangerouslySetInnerHTML={{ __html: activeConv.bio || 'No bio available' }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
