import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE, fixImgUrl } from '../constants';

export function useRequestQueue() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchQueue = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE}/apiv2/chat/request/`);
            if (response.data && response.data.reqlist) {
                const mapped = response.data.reqlist.map(req => ({
                    ...req,
                    imgURL: fixImgUrl(req.imgURL)
                }));
                setRequests(mapped);
            }
            setError(null);
        } catch (err) {
            console.error('[Queue] Error fetching requests:', err);
            setError('Failed to load request queue');
        } finally {
            setLoading(false);
        }
    }, []);

    const acceptRequest = async (convID) => {
        try {
            const url = `${API_BASE}/apiv2/chat/conversation/${convID}/accept`;
            const response = await axios.post(url, { reqStatus: 'accept' });
            if (response.data && response.data.ack === 'success') {
                // Remove from local list immediately
                setRequests(prev => prev.filter(r => r.convID !== convID));
                return true;
            }
            return false;
        } catch (err) {
            console.error('[Queue] Error accepting request:', err);
            return false;
        }
    };

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    return { requests, loading, error, fetchQueue, acceptRequest };
}
