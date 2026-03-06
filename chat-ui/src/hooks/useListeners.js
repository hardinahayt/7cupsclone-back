import axios from 'axios';
import { useEffect, useState } from 'react';
import { API_BASE, fixImgUrl } from '../constants';
import { ensureNotificationPermission } from './useConversations';

const PAGES_TO_FETCH = 5;

/**
 * Manages listener browse state: bulk-fetching 5 pages at once on load,
 * filters, broadcast messaging, and starting a chat.
 */
export function useListeners({ activeConvId, fetchData, setActiveConv }) {
    const [listeners, setListeners] = useState([]);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [browseGender, setBrowseGender] = useState('F');
    const [browseCountry, setBrowseCountry] = useState('');
    const [page, setPage] = useState(PAGES_TO_FETCH);
    const [chatInitiating, setChatInitiating] = useState(null);

    // ── Broadcast state ──────────────────────────────────────────────────
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastProgress, setBroadcastProgress] = useState({ done: 0, total: 0, errors: 0 });
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);

    // Fetch multiple pages in parallel and merge unique results
    const fetchListeners = async (startPage = 1, totalPages = 1, gender = browseGender, country = browseCountry, reset = false) => {
        setBrowseLoading(true);
        try {
            const pageNums = Array.from({ length: totalPages }, (_, i) => startPage + i);
            const requests = pageNums.map(pg =>
                axios.get(
                    `${API_BASE}/BrowseListeners/?badge=0&find=&sort=&category=&ageGroup=&listType=&gender=${gender}&religion=&country=${country}&language=&pg=${pg}`,
                    { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }
                ).catch(() => null)
            );
            const responses = await Promise.all(requests);
            const allListeners = responses
                .filter(Boolean)
                .flatMap(res => {
                    const data = res.data.list || res.data;
                    if (!Array.isArray(data)) return [];
                    return data.filter(l => l.screenName).map(l => ({
                        ...l,
                        image: fixImgUrl(l.image),
                        imgURL: fixImgUrl(l.imgURL),
                        CountryFlag: fixImgUrl(l.CountryFlag)
                    }));
                });

            // Deduplicate by listID/userID
            const seen = new Set();
            const unique = allListeners.filter(l => {
                const id = l.listID || l.userID;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });

            if (reset) setListeners(unique);
            else setListeners(prev => {
                const prevIds = new Set(prev.map(l => l.listID || l.userID));
                return [...prev, ...unique.filter(l => !prevIds.has(l.listID || l.userID))];
            });
        } catch (err) {
            console.error('[fetchListeners]', err);
        } finally {
            setBrowseLoading(false);
        }
    };

    // Re-fetch 5 pages when filters change or browse opens
    useEffect(() => {
        if (activeConvId === 'browse') {
            setPage(PAGES_TO_FETCH);
            fetchListeners(1, PAGES_TO_FETCH, browseGender, browseCountry, true);
        }
    }, [browseGender, browseCountry, activeConvId]);

    // ── Broadcast logic ──────────────────────────────────────────────────
    const startBroadcast = async () => {
        if (!broadcastMsg.trim() || broadcasting) return;
        setBroadcasting(true);
        setBroadcastProgress({ done: 0, total: listeners.length, errors: 0 });

        for (const listener of listeners) {
            const targetId = listener.listID || listener.userID;
            try {
                // Step 1: Create/get conversation
                const convRes = await axios.post(`${API_BASE}/apiv2/chat/conversation`, {
                    userID: targetId, userType: listener.userType || 'l', bypassAd: false
                });
                const convID = convRes.data?.data?.convID || convRes.data?.convID;
                if (convID) {
                    // Step 2: Send message
                    await axios.post(`${API_BASE}/apiv2/chat/conversation/${convID}/message`, {
                        convID, comment: broadcastMsg,
                        msgHash: Math.random().toString(36).slice(2)
                    }, { headers: { 'referer': `https://www.7cups.com/chat/?c=${convID}` } });
                }
                setBroadcastProgress(p => ({ ...p, done: p.done + 1 }));
            } catch (err) {
                console.error(`[broadcast] failed for ${listener.screenName}`, err);
                setBroadcastProgress(p => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
            }
            // Small delay to avoid hammering API
            await new Promise(r => setTimeout(r, 300));
        }

        setBroadcasting(false);
        await fetchData();
    };

    // ── Start chat ───────────────────────────────────────────────────────
    const handleStartChat = async (listener) => {
        ensureNotificationPermission();
        const targetId = listener.listID || listener.userID;
        setChatInitiating(targetId);
        try {
            const res = await axios.post(`${API_BASE}/apiv2/chat/conversation`, {
                userID: targetId, userType: listener.userType || 'l', bypassAd: false
            });
            await fetchData();
            const newConvID = res.data?.data?.convID || res.data?.convID;
            if (newConvID) {
                setActiveConv({
                    id: newConvID,
                    name: listener.screenName,
                    imgURL: fixImgUrl(listener.image || listener.imgURL),
                    bio: listener.bio || listener.textBio,
                    listenerLevel: listener.listenerLevel,
                    numConversations: listener.numConversations,
                    CountryFlag: fixImgUrl(listener.CountryFlag),
                    isListener: true
                });
            }
        } catch (err) {
            console.error('[handleStartChat]', err);
            await fetchData();
        } finally {
            setChatInitiating(null);
        }
    };

    return {
        listeners, setListeners,
        browseLoading,
        browseGender, setBrowseGender,
        browseCountry, setBrowseCountry,
        page, setPage,
        chatInitiating,
        fetchListeners,
        handleStartChat,
        // Broadcast
        broadcastMsg, setBroadcastMsg,
        broadcasting,
        broadcastProgress,
        showBroadcastModal, setShowBroadcastModal,
        startBroadcast,
    };
}
