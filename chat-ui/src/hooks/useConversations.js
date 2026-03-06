import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { API_BASE, fixImgUrl } from '../constants';

export function ensureNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Manages conversations list, active conversation selection, categories,
 * and the 15-second background status refresh.
 */
export function useConversations({ listenersCache }) {
    const [conversations, setConversations] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    const activeConvRef = useRef(null);
    const conversationsRef = useRef([]);

    useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
    useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

    const selectConversation = (conv) => {
        ensureNotificationPermission();
        const cachedListener = listenersCache?.find(l =>
            l.screenName === conv.name || (l.listID || l.userID) === conv.id
        );

        const enriched = {
            ...conv,
            imgURL: fixImgUrl(conv.imgURL || cachedListener?.image || cachedListener?.imgURL),
            bio: conv.bio || cachedListener?.bio || cachedListener?.textBio,
            listenerLevel: conv.listenerLevel || cachedListener?.listenerLevel || cachedListener?.memberLevel,
            numConversations: conv.numConversations || cachedListener?.numConversations,
            CountryFlag: fixImgUrl(conv.CountryFlag || cachedListener?.CountryFlag),
            isListener: conv.isListener || !!cachedListener
        };

        setActiveConv(prev => {
            if (prev?.id === enriched.id && prev?.name === enriched.name) return prev;
            return enriched;
        });

        if (conv.unreadCount > 0) {
            setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
        }
    };

    const fetchData = async (isQuiet = false) => {
        if (!isQuiet) setLoading(true);
        try {
            const [cRes, catRes] = await Promise.all([
                axios.get(`${API_BASE}/apiv2/chat/conversation/`),
                axios.get(`${API_BASE}/ajax/issueArray.php`)
            ]);

            setConversations(prev => {
                const prevMap = new Map((prev || []).map(p => [p.id, p.unreadCount || 0]));

                const mapped = (cRes.data.conversations || []).map(c => ({
                    id: c.convID,
                    name: c.otherScreenName || 'User',
                    nodeRoom: c.nodeRoom,
                    unreadCount: Math.max(c.new || 0, prevMap.get(c.convID) || 0),
                    isGroup: !!c.chatRoomType || c.otherType === 'g' || c.groupSupportChats === 1,
                    isBot: c.convID === 'Noni' || c.otherType === 'b',
                    lastMsg: c.lastMsg,
                    lastMsgTime: c.lastMsgTime,
                    imgURL: fixImgUrl(c.imgURL),
                    isOnline: c.otherOnline > 0 || c.onlineNow > 0,
                    reqType: c.reqType,
                    reqStatus: c.reqStatus,
                    country: c.otherCountry || null,
                    countryFull: c.otherCountryFull || null,
                    CountryFlag: fixImgUrl(c.otherCountryFlag || null)
                }));
                return mapped.sort((a, b) => (b.lastMsgTime || 0) - (a.lastMsgTime || 0));
            });

            setCategories(Object.values(catRes.data));

            if (!activeConvRef.current) {
                // Better selection logic: prefer conversations with messages or non-personal ones
                const validConversations = conversations.filter(c =>
                    !c.isBot && (c.unreadCount > 0 || c.reqType !== 'personal')
                );
                if (validConversations.length > 0) {
                    const first = validConversations[0];
                    selectConversation(first);
                } else if (conversations.length > 0) {
                    selectConversation(conversations[0]);
                }
            }
        } catch (err) {
            console.error('[fetchData]', err);
        } finally {
            if (!isQuiet) setLoading(false);
        }
    };

    // Removed manual polling loop to rely entirely on real-time WebSocket pushes
    // and the backend background Checker for auto-accepts.

    return {
        conversations, setConversations,
        activeConv, setActiveConv,
        activeConvRef, conversationsRef,
        categories,
        loading,
        fetchData,
        selectConversation,
    };
}
