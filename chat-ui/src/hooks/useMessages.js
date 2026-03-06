import axios from 'axios';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../constants';

/**
 * Manages messages state, message fetching, sending, input handling,
 * typing indicator emission, and smart auto-scroll.
 */
export function useMessages({ activeConv, socket }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const lastActiveId = useRef(null);

    // Smart scroll: only scroll if already near bottom or typing
    useEffect(() => {
        if (!messageListRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (isAtBottom || isTyping) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Clear and fetch messages only when active conversation ID changes
    useEffect(() => {
        const id = activeConv?.id;
        if (!id || id === 'browse') {
            setMessages([]);
            lastActiveId.current = id || null;
            return;
        }
        if (id !== lastActiveId.current) {
            setMessages([]);
            fetchMessages(id);
            lastActiveId.current = id;
        }
    }, [activeConv?.id]);

    const fetchMessages = async (id) => {
        try {
            const res = await axios.get(`${API_BASE}/apiv2/chat/conversation/${id}/message/`);
            const sorted = (res.data.messages || []).sort((a, b) => (a.msgTS || 0) - (b.msgTS || 0));
            setMessages(sorted.map(m => ({
                id: m.msgHash || m.id,
                text: m.msgBody || m.comment,
                sender: m.convSide === 'mine' ? 'me' : 'other',
                timestamp: m.msgTS || moment().unix()
            })));
        } catch (err) { console.error('[fetchMessages]', err); }
    };

    const handleInput = (e) => {
        setInput(e.target.value);
        if (socket && activeConv) {
            socket.emit('sendConvAction', {
                action: 'typingStatus',
                convID: activeConv.id,
                room: activeConv.nodeRoom || activeConv.id,
                screenName: 'me',
                isTyping: true
            });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('sendConvAction', {
                    action: 'typingStatus',
                    convID: activeConv.id,
                    room: activeConv.nodeRoom || activeConv.id,
                    screenName: 'me',
                    isTyping: false
                });
            }, 2000);
        }
    };

    const sendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!input.trim() || !activeConv) return;

        const msgHash = Math.random().toString(36).substring(7);
        const userMsg = { id: msgHash, text: input, sender: 'me', timestamp: moment().unix() };
        setMessages(prev => [...prev, userMsg]);
        const sentInput = input;
        setInput('');

        try {
            const response = await axios.post(
                `${API_BASE}/apiv2/chat/conversation/${activeConv.id}/message`,
                { convID: activeConv.id, comment: sentInput, msgHash }
            );

            if (response.data.bot?.length > 0) {
                (async () => {
                    for (const botMsg of response.data.bot) {
                        await new Promise(r => setTimeout(r, (botMsg.delayTime || 1) * 1000));
                        setIsTyping(true);
                        await new Promise(r => setTimeout(r, (botMsg.typingTime || 2) * 1000));
                        setIsTyping(false);
                        setMessages(prev => [...prev.filter(m => m.id !== botMsg.msgHash), {
                            id: botMsg.msgHash || Date.now(),
                            text: botMsg.msgBody,
                            sender: 'other',
                            timestamp: botMsg.msgTS || moment().unix()
                        }].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
                    }
                })();
            }

            socket?.emit('sendConvAction', {
                action: 'newMessage',
                convID: activeConv.id,
                room: activeConv.nodeRoom || activeConv.id,
                screenName: 'me',
                msgHash,
                message: { convID: activeConv.id, msgBody: sentInput, msgHash, msgTS: moment().unix() }
            });
        } catch (err) { console.error('[sendMessage]', err); }
    };

    return {
        messages, setMessages,
        input,
        isTyping, setIsTyping,
        messagesEndRef, messageListRef,
        handleInput,
        sendMessage,
        fetchMessages
    };
}
