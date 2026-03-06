import moment from 'moment';
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../constants';

/**
 * Manages the Socket.io connection and all real-time recConvAction events.
 * Returns the socket instance and connection status.
 */
export function useSocket({ activeConvRef, conversationsRef, setMessages, setConversations, setIsTyping, onConnected, onQueueUpdate }) {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Prepare notification sound
        window.notifSound = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq/');

        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setIsConnected(true);
            console.log('[Socket] Connected to local socket');
            onConnected?.();
        });

        newSocket.on('chatRequestQueueUpdate', (data) => {
            console.log('[Socket] chatRequestQueueUpdate received:', data);
            onQueueUpdate?.(data);
        });

        newSocket.on('recConvAction', (data) => {
            const currentActive = activeConvRef.current;

            if (data.action === 'newMessage') {
                const room = data.room || data.convID;
                const text = data.text || data.message?.msgBody || data.message?.comment || '...';
                const msgHash = data.msgHash || data.message?.msgHash || Date.now();
                const senderScreenName = data.message?.user?.screenName || data.screenName;

                const activeId = activeConvRef.current?.id;
                console.log(`[Socket] recConvAction:`, { action: data.action, room, activeId });

                const isMatch = (id1, id2) => String(id1 || '').toLowerCase().trim() === String(id2 || '').toLowerCase().trim();

                if (isMatch(room, activeId) || isMatch(room, activeConvRef.current?.nodeRoom)) {
                    // Update thread
                    setMessages(prev => {
                        if (prev.find(m => m.id === msgHash)) return prev;

                        let isMine = data.convSide === 'mine';
                        if (!isMine) {
                            isMine = activeConvRef.current?.name === 'Noni'
                                ? String(senderScreenName).toLowerCase() !== 'noni'
                                : String(senderScreenName).toLowerCase() !== String(activeConvRef.current?.name).toLowerCase();
                        }

                        if (!isMine) {
                            if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
                                new Notification(`New message from ${senderScreenName}`, { body: text });
                            }
                            window.notifSound?.play().catch(() => { });
                        }

                        return [...prev, {
                            id: msgHash,
                            text,
                            sender: isMine ? 'me' : 'other',
                            timestamp: data.timestamp || data.message?.msgTS || moment().unix()
                        }].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    });

                    // Update sidebar (even if it's the active one)
                    setConversations(prev => {
                        const next = prev.map(c =>
                            (String(c.id) === String(room) || String(c.nodeRoom) === String(room))
                                ? { ...c, lastMsg: text, lastMsgTime: moment().unix() }
                                : c
                        );
                        return [...next].sort((a, b) => (b.lastMsgTime || 0) - (a.lastMsgTime || 0));
                    });
                } else if (room) {

                    const isMine = data.convSide === 'mine' || senderScreenName === 'me';
                    const targetConv = conversationsRef.current?.find(c => c.id === room || c.nodeRoom === room);
                    if (!isMine && !targetConv?.isGroup) {
                        try {
                            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                                new Notification(`New message from ${senderScreenName}`, { body: text });
                            }
                            window.notifSound?.play().catch(() => { });
                        } catch (e) { }

                        setConversations(prev => {
                            const next = prev.map(c =>
                                (c.id === room || c.nodeRoom === room)
                                    ? { ...c, unreadCount: (c.unreadCount || 0) + 1, lastMsg: text, lastMsgTime: moment().unix() }
                                    : c
                            );
                            return [...next].sort((a, b) => (b.lastMsgTime || 0) - (a.lastMsgTime || 0));
                        });
                    }
                }
            }

            if (data.action === 'typingStatus') {
                const room = data.room || data.convID;
                if (room === currentActive?.id || room === currentActive?.nodeRoom) {
                    const isSelf = data.screenName === 'me' || data.screenName === 'Prateeeeekk';
                    const isOther = data.screenName === currentActive.name || (!isSelf && data.screenName);
                    if (isOther) {
                        setIsTyping(data.isTyping);
                        if (data.isTyping) {
                            if (window.typingTimeout) clearTimeout(window.typingTimeout);
                            window.typingTimeout = setTimeout(() => setIsTyping(false), 4000);
                        }
                    }
                }
            }
        });

        newSocket.on('disconnect', () => setIsConnected(false));

        return () => newSocket.close();
    }, []);

    return { socket, isConnected };
}
