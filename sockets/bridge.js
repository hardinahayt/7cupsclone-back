// server/sockets/bridge.js
const ioClient = require('socket.io-client');
const axios = require('axios');
const moment = require('moment');
const { PROD_SOCKET_URL, TARGET_BASE } = require('../config/constants');
const identity = require('../config/identity');
const autoReplyState = require('../config/autoReplyState');
const { generateReply } = require('../services/aiReply');
const { log } = require('../utils/logger');
const { sendProductionMessage, acceptProductionRequest } = require('../utils/productionApi');

let prodSocket;
let localIoInstance;
const activeChannels = new Set();
const idMap = new Map(); // UUID -> LocalID (2_...)
const pendingReplies = new Map(); // convID -> { timeoutId, lastMsgHash }



/**
 * Centralized function to emit events to the local UI.
 * Handles ID mapping (UUID -> LocalID) to ensure both sidebar and thread update.
 */
function emitToLocal(room, eventName, data) {
    if (!localIoInstance || !room) return;

    // Always emit to the requested room
    localIoInstance.to(room).emit(eventName, data);

    // Find mapped room (either direction: UUID -> 2_... or 2_... -> UUID)
    let mappedRoom = idMap.get(room);
    if (!mappedRoom) {
        // Reverse lookup: check if 'room' is already a mapped value
        for (const [key, value] of idMap.entries()) {
            if (value === room) {
                mappedRoom = key;
                break;
            }
        }
    }

    // If there's a mapped counterpart, emit there too for redundancy
    if (mappedRoom) {
        // Create a slight variant of the data specifically for the mapped room
        // so the frontend sees it exactly as expected for that room ID
        const mappedData = { ...data, room: mappedRoom, convID: mappedRoom };
        localIoInstance.to(mappedRoom).emit(eventName, mappedData);
    }
}

// Handle an incoming production message and auto-reply if enabled
async function handleIncomingForAutoReply(data, localIo) {
    const rawID = data.room || data.convID || data.message?.convID;
    const convID = idMap.get(rawID) || rawID;

    const senderName = data.message?.user?.screenName || data.screenName || '';
    const text = data.text || data.message?.msgBody || data.message?.comment || '';
    const isMine = data.convSide === 'mine' || data.message?.convSide === 'mine' || senderName === 'me';

    if (convID && text) {
        // Record every message for context
        const role = isMine ? 'assistant' : 'user';
        const { recordMessage } = require('../services/aiReply');
        recordMessage(convID, role, text);
    }

    const isEnabled = autoReplyState.isEnabled(convID);

    // Log for debugging
    if (data.action === 'newMessage' || data.text) {
        log(`[AutoReply-Debug] rawID: ${rawID}, convID: ${convID}, isEnabled: ${isEnabled}, isMine: ${isMine}`);
    }

    if (!convID || !isEnabled || isMine) return;
    if (data.action !== 'newMessage') return;

    // Skip if excluded
    if (autoReplyState.excludedConvs.has(convID)) return;

    // Cancel any existing pending reply for this conv since a new message arrived
    if (pendingReplies.has(convID)) {
        log(`[AutoReply] New message in ${convID}, resetting pending reply timer.`);
        clearTimeout(pendingReplies.get(convID).timeoutId);
        pendingReplies.delete(convID);
    }

    log(`[AutoReply] Incoming from ${senderName} in ${convID}: "${text.slice(0, 80)}"`);

    // Simulate human typing delay (15–30 seconds)
    const delay = 15000 + Math.random() * 15000;
    log(`[AutoReply] Waiting ${Math.round(delay / 1000)}s before replying...`);

    const timeoutId = setTimeout(async () => {
        try {
            // CRITICAL: Only reply if the LAST message in history is still from the sender
            const history = require('../services/aiReply').conversationHistory?.get(convID) || [];
            const lastMsg = history[history.length - 1];

            if (lastMsg && lastMsg.role !== 'user') {
                log(`[AutoReply] Aborting reply for ${convID}: User sent a message during delay.`);
                return;
            }

            const currentHash = lastMsg?.id || lastMsg?.content?.slice(0, 100);
            if (autoReplyState.lastReplied.get(convID) === currentHash) {
                log(`[AutoReply] Already replied to this message (${convID}).`);
                return;
            }

            const reply = await generateReply(convID, text, senderName);
            await sendProductionMessage(convID, reply);

            // Mark as replied
            autoReplyState.lastReplied.set(convID, currentHash);
            autoReplyState.save();

            log(`[AutoReply] ✅ AI reply sent for ${convID}. Emitting to UI...`);

            // Also broadcast to local UI so the chat updates without refresh
            const msgObj = {
                action: 'newMessage',
                convID,
                room: convID,
                convSide: 'mine',
                text: reply,
                message: {
                    msgBody: reply,
                    msgHash: 'ai_' + Math.random().toString(36).slice(2, 7),
                    msgTS: moment().unix(),
                    convID,
                    user: { screenName: 'me' }
                },
                timestamp: moment().unix()
            };

            emitToLocal(convID, 'recConvAction', msgObj);
            log(`[AutoReply] 📣 Emitted newMessage via mapped logic: ${convID}`);
        } catch (err) {
            log(`[AutoReply] Error during auto-reply flow for ${convID}: ${err.message}`);
        } finally {
            pendingReplies.delete(convID);
        }
    }, delay);

    pendingReplies.set(convID, { timeoutId });
}

function initProdSocket(localIo) {
    localIoInstance = localIo;
    const cookies = process.env.SEVEN_CUPS_COOKIES || '';
    if (!cookies) {
        console.warn('Cannot initialize Production WebSocket: No SEVEN_CUPS_COOKIES found in .env');
        return;
    }

    console.log(`Connecting to Production WebSocket: ${PROD_SOCKET_URL}`);
    prodSocket = ioClient(PROD_SOCKET_URL, {
        transports: ['polling', 'websocket'], // Match browser's default behavior
        extraHeaders: {
            'Cookie': cookies,
            'Origin': 'https://www.7cups.com',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://www.7cups.com/'
        }
    });

    prodSocket.on('connect', () => {
        log('Connected to Production WebSocket');

        // Emulate the frontend's queue subscription handshake
        if (identity.requestQueFilter) {
            log(`[Bridge] Emitting subscribeChatRequestQueue with filter...`);
            prodSocket.emit('subscribeChatRequestQueue', identity.requestQueFilter);
        } else {
            log(`[Bridge] ⚠️ Missing requestQueFilter in identity. Real-time queue updates may not work until the UI requests /apiv2/chat/conversation/.`);
        }

        // Always join personal identity rooms to receive global/private pushes
        const identityRooms = [identity.proxyScreenName, identity.proxyUserTypeID, identity.proxyMeToken].filter(Boolean);
        if (identityRooms.length > 0) {
            log(`[Bridge] Joining identity rooms on Production: ${identityRooms.join(', ')}`);
            prodSocket.emit('addToRooms', identityRooms);
        }

        if (activeChannels.size > 0) {
            log(`[Bridge] Joining ${activeChannels.size} previously active channels: ${Array.from(activeChannels).join(', ')}`);
            prodSocket.emit('addToRooms', Array.from(activeChannels));
        }
        const activeLocalRooms = Array.from(localIo.sockets.adapter.rooms.keys())
            .filter(r => !localIo.sockets.adapter.sids.has(r));
        if (activeLocalRooms.length > 0) {
            log(`[Bridge] Joining ${activeLocalRooms.length} active local rooms: ${activeLocalRooms.join(', ')}`);
            prodSocket.emit('addToRooms', activeLocalRooms);
        }
    });

    prodSocket.onAny((eventName, ...args) => {
        const data = args[0] || {};

        // Log all events for a short period to debug
        log(`[Bridge-Debug] Incoming Event: ${eventName}`);

        const allowedEvents = [
            'recConvAction',
            'notification',
            'chatRequestQueueUpdate',
            'chatStatusUpdate',
            'chatQueueUpdate',
            'requestQueueUpdate'
        ];

        if (allowedEvents.includes(eventName)) {
            const rawRoom = data.room || data.roomID || (data.message && data.message.convID) || data.convID;
            const mappedRoom = idMap.get(rawRoom);

            log(`[Bridge] Event: ${eventName}, AutoMode: ${autoReplyState.autoMode}, Room: ${rawRoom || 'global'}`);

            if (eventName.includes('QueueUpdate') || eventName === 'chatRequestQueueUpdate') {
                log(`[Bridge] Queue Update Data: ${JSON.stringify(data).slice(0, 500)}`);

                // Emit to everyone for queue updates
                localIo.emit('chatRequestQueueUpdate', data);

                // --- AUTO-MODE LOGIC ---
                if (autoReplyState.autoMode) {
                    const requests = data.reqlist || data.requests || [];
                    log(`[AutoMode] Checking ${requests.length} requests in queue.`);

                    // Log all request types found
                    const types = [...new Set(requests.map(r => r.reqType))];
                    if (types.length > 0) log(`[AutoMode] Request types found: ${types.join(', ')}`);

                    // Accept BOTH 'general' and any other common request types if AutoMode is ON
                    const autoAcceptTypes = ['general', 'personal'];
                    const toAccept = requests.filter(r => autoAcceptTypes.includes(r.reqType));

                    if (toAccept.length > 0) {
                        log(`[AutoMode] 🚀 Detected ${toAccept.length} eligible requests. Processing...`);
                        toAccept.forEach(async (req) => {
                            try {
                                log(`[AutoMode] ⚡ Auto-accepting ${req.convID} (Type: ${req.reqType}, User: ${req.userScreenName})...`);
                                await acceptProductionRequest(req.convID);

                                log(`[AutoMode] 🤖 Enabling AI auto-reply for ${req.convID}...`);
                                autoReplyState.enable(req.convID);

                                // Notify local UI to refresh conversations
                                localIo.emit('recConvAction', { action: 'refreshConversations', timestamp: moment().unix() });
                            } catch (err) {
                                log(`[AutoMode] ❌ Error processing ${req.convID}: ${err.message}`);
                            }
                        });
                    }
                }
            } else if (rawRoom) {
                emitToLocal(rawRoom, eventName, data);
            }

            // Sync for auto-reply
            handleIncomingForAutoReply(data, localIo);
        }
    });

    prodSocket.on('error', (err) => console.error('Production WebSocket Error:', err));
}

function setupWebSockets(localIo) {
    initProdSocket(localIo);

    localIo.on('connection', (socket) => {
        console.log(`New local connection: ${socket.id}`);

        socket.on('sendConvAction', (data, callback) => {
            const { action, convID } = data;

            if (convID && action === 'newMessage') {
                const text = data.text || data.message?.msgBody || '';
                log(`[Bridge] Manual message in ${convID}: "${text.slice(0, 40)}"`);

                // Record manual message for AI context
                const { recordMessage } = require('../services/aiReply');
                recordMessage(convID, 'assistant', text);

                // Cancel any pending auto-reply
                if (pendingReplies.has(convID)) {
                    log(`[AutoReply] User sent manual message in ${convID}, cancelling pending AI reply.`);
                    clearTimeout(pendingReplies.get(convID).timeoutId);
                    pendingReplies.delete(convID);
                }
            }

            if (convID) {
                localIo.to(convID).emit('recConvAction', {
                    ...data,
                    senderID: socket.id,
                    timestamp: moment().unix()
                });
            }

            if (prodSocket && prodSocket.connected && prodSocket.io?.engine?.id) {
                const enrichedData = {
                    action: data.action,
                    room: data.room || data.convID,
                    me: identity.proxyMeToken || undefined
                };

                if (data.action === 'typingStatus') {
                    enrichedData.userTypeID = identity.proxyUserTypeID || undefined;
                    enrichedData.isTyping = data.isTyping;
                } else if (data.action === 'newMessage') {
                    enrichedData.message = data.message;
                    if (enrichedData.message) {
                        enrichedData.message.userTypeID = identity.proxyUserTypeID || undefined;
                    }
                }

                const sid = prodSocket.io.engine.id;
                const pushUrl = `${PROD_SOCKET_URL}/socket.io/?EIO=4&transport=polling&sid=${sid}`;
                const payloadStr = `42["sendConvAction",${JSON.stringify(enrichedData)}]`;
                const pushCookies = process.env.SEVEN_CUPS_COOKIES || '';

                axios.post(pushUrl, payloadStr, {
                    headers: { 'Cookie': pushCookies, 'Origin': 'https://www.7cups.com', 'Content-Type': 'text/plain;charset=UTF-8' }
                }).catch(err => console.error(`[PROXY] Raw Push Error: ${err.message}`));
            } else {
                console.warn(`[PROXY] Cannot forward ${action}: Native production socket disconnected.`);
            }

            if (callback) callback({ status: 'ok' });
        });

        socket.on('addToRooms', (rooms) => {
            const arrRooms = Array.isArray(rooms) ? rooms : [rooms];
            log(`[Bridge] Local socket ${socket.id} joining rooms: ${arrRooms.join(', ')}`);

            // If we see a 2_ ID and a raw ID together, map them
            if (arrRooms.length >= 2) {
                const localId = arrRooms.find(r => String(r).startsWith('2_'));
                const rawId = arrRooms.find(r => !String(r).startsWith('2_'));
                if (rawId && localId) {
                    log(`[Bridge] Mapping RawID ${rawId} to LocalID ${localId}`);
                    idMap.set(rawId, localId);
                    idMap.set(localId, rawId);
                }
            }

            arrRooms.forEach(r => {
                socket.join(r);
                activeChannels.add(r);
            });
            if (prodSocket && prodSocket.connected) {
                log(`[Bridge] Forwarding addToRooms to Production: ${arrRooms.join(', ')}`);
                prodSocket.emit('addToRooms', arrRooms);
            }
        });

        socket.on('disconnect', () => console.log(`User disconnected: ${socket.id}`));
    });
}

function getLocalIo() {
    return localIoInstance;
}

module.exports = { setupWebSockets, emitToLocal, getLocalIo };
