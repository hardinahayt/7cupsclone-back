import { useEffect, useRef } from 'react';
import { BrowseListeners } from './components/BrowseListeners';
import { ChatHeader } from './components/ChatHeader';
import { MessageInput } from './components/MessageInput';
import { MessageList } from './components/MessageList';

import { ProfileModal } from './components/ProfileModal';
import { Sidebar } from './components/Sidebar';
import { useAutoReply } from './hooks/useAutoReply';
import { useConversations } from './hooks/useConversations';
import { useListeners } from './hooks/useListeners';
import { useMessages } from './hooks/useMessages';
import { useRequestQueue } from './hooks/useRequestQueue';
import { useSocket } from './hooks/useSocket';
import { useUserProfile } from './hooks/useUserProfile';

function App() {
    // ── Conversations & sidebar state ──────────────────────────────────────
    const {
        conversations, setConversations,
        activeConv, setActiveConv,
        activeConvRef, conversationsRef,
        categories, loading,
        fetchData, selectConversation,
    } = useConversations({ listenersCache: [] });


    // ── Listeners browse ──────────────────────────────────────────────────
    const listenersHook = useListeners({
        activeConvId: activeConv?.id,
        fetchData,
        setActiveConv
    });

    // ── Circular Dependency Handling ───────────────────────────────────────
    const setMessagesRef = useRef();
    const setIsTypingRef = useRef();

    // ── Request Queue ───────────────────────────────────────────────────
    const requestQueue = useRequestQueue();
    // Expose for sidebar to use without prop drilling for now
    window.requestQueue = requestQueue;

    // ── Socket ────────────────────────────────────────────────────────────
    const { socket, isConnected } = useSocket({
        activeConvRef,
        conversationsRef,
        setMessages: (val) => setMessagesRef.current?.(val),
        setConversations,
        setIsTyping: (val) => setIsTypingRef.current?.(val),
        onConnected: fetchData,
        onQueueUpdate: () => {
            console.log('[App] Queue update received via socket, re-fetching...');
            requestQueue.fetchQueue();
        }
    });

    // Refresh when requested by proxy (e.g. after accept)
    useEffect(() => {
        if (socket) {
            socket.on('recConvAction', (data) => {
                if (data.action === 'refreshConversations') {
                    console.log('[App] Refreshing conversations as requested by server');
                    fetchData();
                    requestQueue.fetchQueue();
                }
            });
            return () => socket.off('recConvAction');
        }
    }, [socket, fetchData, requestQueue.fetchQueue]);

    // Join room when activeConv changes
    useEffect(() => {
        if (socket && activeConv?.id) {
            const rooms = [activeConv.id, activeConv.nodeRoom].filter(Boolean);
            socket.emit('addToRooms', rooms);
            console.log(`[Socket] Joined rooms for activeConv:`, rooms);
        }
    }, [socket, activeConv?.id]);

    // ── Messages & input ──────────────────────────────────────────────────
    const {
        messages, setMessages,
        input, isTyping, setIsTyping,
        messagesEndRef, messageListRef,
        handleInput, sendMessage,
    } = useMessages({ activeConv, socket });

    // Sync state refs for socket callbacks
    useEffect(() => {
        setMessagesRef.current = setMessages;
        setIsTypingRef.current = setIsTyping;
    }, [setMessages, setIsTyping]);


    // Wire socket rooms whenever conversations load
    useEffect(() => {
        if (socket && conversations.length > 0) {
            const rooms = conversations
                .filter(c => !c.isGroup)
                .flatMap(c => [c.id, c.nodeRoom].filter(Boolean));
            if (rooms.length > 0) socket.emit('addToRooms', rooms);
        }
    }, [socket, conversations]);

    // ── Profile modal ─────────────────────────────────────────────────────
    const {
        showProfileModal, setShowProfileModal,
        profileLoading, fetchUserProfile
    } = useUserProfile({ setActiveConv, setConversations });

    // ── Auto-Reply ────────────────────────────────────────────────────────
    const { isEnabled, toggleConv, suggestReply, suggesting } = useAutoReply();

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="app-container">
            <Sidebar
                conversations={conversations}
                activeConv={activeConv}
                categories={categories}
                selectConversation={selectConversation}
                setActiveConv={setActiveConv}
            />

            <main className="main-area">
                <ChatHeader
                    activeConv={activeConv}
                    loading={loading}
                    fetchData={fetchData}
                    onAvatarClick={() => {
                        setShowProfileModal(true);
                        fetchUserProfile(activeConv?.name);
                    }}
                    autoReplyEnabled={isEnabled(activeConv?.id)}
                    toggleAutoReply={() => toggleConv(activeConv?.id)}
                />

                {showProfileModal && activeConv && (
                    <ProfileModal
                        activeConv={activeConv}
                        profileLoading={profileLoading}
                        onClose={() => setShowProfileModal(false)}
                    />
                )}

                <div className="chat-log">
                    {activeConv?.id === 'browse' ? (
                        <BrowseListeners
                            listeners={listenersHook.listeners}
                            browseLoading={listenersHook.browseLoading}
                            browseGender={listenersHook.browseGender}
                            setBrowseGender={listenersHook.setBrowseGender}
                            browseCountry={listenersHook.browseCountry}
                            setBrowseCountry={listenersHook.setBrowseCountry}
                            page={listenersHook.page}
                            setPage={listenersHook.setPage}
                            chatInitiating={listenersHook.chatInitiating}
                            fetchListeners={listenersHook.fetchListeners}
                            handleStartChat={listenersHook.handleStartChat}
                            broadcastMsg={listenersHook.broadcastMsg}
                            setBroadcastMsg={listenersHook.setBroadcastMsg}
                            broadcasting={listenersHook.broadcasting}
                            broadcastProgress={listenersHook.broadcastProgress}
                            showBroadcastModal={listenersHook.showBroadcastModal}
                            setShowBroadcastModal={listenersHook.setShowBroadcastModal}
                            startBroadcast={listenersHook.startBroadcast}
                        />
                    ) : (
                        <MessageList
                            messages={messages}
                            isTyping={isTyping}
                            activeConvName={activeConv?.name}
                            messagesEndRef={messagesEndRef}
                            messageListRef={messageListRef}
                        />
                    )}
                </div>

                <MessageInput
                    input={input}
                    activeConv={activeConv}
                    handleInput={handleInput}
                    sendMessage={sendMessage}
                    suggestReply={suggestReply}
                    suggesting={suggesting}
                    setMessages={setMessages}
                    messages={messages}
                />
            </main>
        </div>
    );
}

export default App;
