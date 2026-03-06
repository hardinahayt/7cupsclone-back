import axios from 'axios';
import { useEffect, useState } from 'react';
import { API_BASE } from '../constants';

/**
 * Per-conversation auto-reply state synced with the backend.
 */
export function useAutoReply() {
    const [enabledConvs, setEnabledConvs] = useState(new Set());
    const [suggesting, setSuggesting] = useState(false);

    // Fetch initial state
    useEffect(() => {
        axios.get(`${API_BASE}/auto-reply/status`)
            .then(res => setEnabledConvs(new Set(res.data.enabledConvs || [])))
            .catch(() => { });
    }, []);

    const isEnabled = (convID) => enabledConvs.has(String(convID));

    const toggleConv = async (convID) => {
        try {
            const res = await axios.post(`${API_BASE}/auto-reply/toggle-conv`, { convID });
            setEnabledConvs(prev => {
                const next = new Set(prev);
                if (res.data.enabled) next.add(String(convID));
                else next.delete(String(convID));
                return next;
            });
            return res.data.enabled;
        } catch (err) {
            console.error('[useAutoReply] toggle failed', err);
        }
    };

    // Generate a suggestion without sending — returns the reply text
    const suggestReply = async (convID, lastMessage, senderName, history = null) => {
        setSuggesting(true);
        try {
            const res = await axios.post(`${API_BASE}/auto-reply/suggest`, {
                convID, message: lastMessage, senderName, history
            });
            return res.data.reply || '';
        } catch (err) {
            console.error('[useAutoReply] suggest failed', err);
            return '';
        } finally {
            setSuggesting(false);
        }
    };

    return { isEnabled, toggleConv, suggestReply, suggesting };
}
