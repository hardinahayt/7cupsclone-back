const moment = require('moment');
const autoReplyState = require('../config/autoReplyState');
const { getProductionMessages, sendProductionMessage, acceptProductionRequest } = require('../utils/productionApi');
const { generateReply, recordMessage, clearHistory } = require('./aiReply');
const { log } = require('../utils/logger');

let checkerInterval = null;
let localIo = null;

/**
 * Initializes the background checker with the local Socket.IO instance.
 */
function initBackgroundChecker(io) {
    localIo = io;
    if (checkerInterval) clearInterval(checkerInterval);

    log('[BackgroundChecker] Starting proactive auto-reply service...');
    // Check every 30 seconds
    checkerInterval = setInterval(checkAllEnabledConvs, 30000);

    // Fallback Background Queue Poller (every 15 seconds)
    // Helps bypass completely ignoring missing WebSocket queue events without triggering AWS WAF rate limits
    log('[BackgroundChecker] Starting HTTP Fallback Request Queue Poller...');
    setInterval(pollRequestQueue, 15000);
}

/**
 * Fallback to fetch conversation list and check for unaccepted requests.
 */
async function pollRequestQueue() {
    if (!autoReplyState.autoMode) return;

    try {
        const cookies = process.env.SEVEN_CUPS_COOKIES || '';
        const axios = require('axios');
        const { TARGET_BASE } = require('../config/constants');

        const response = await axios.get(`${TARGET_BASE}/apiv2/chat/conversation/`, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                'Origin': 'https://www.7cups.com',
                'Referer': `https://www.7cups.com/chat/`,
                'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin'
            }
        });

        if (response.data && response.data.conversations) {
            const requests = response.data.conversations;
            const autoAcceptTypes = ['general', 'personal'];

            // We only log if we find requests, to avoid spamming the log
            const eligibleRequests = requests.filter(r => r.isRequest && autoAcceptTypes.includes(r.requestType));

            for (const req of eligibleRequests) {
                log(`[HTTP-Fallback-Poller] Found pending request: ${req.id} (${req.requestType}). Accepting...`);
                try {
                    await acceptProductionRequest(req.id);
                    autoReplyState.enable(req.id);
                    log(`[HTTP-Fallback-Poller] Successfully accepted and enabled AI for ${req.id}`);
                } catch (e) {
                    log(`[HTTP-Fallback-Poller] Error accepting req ${req.id}:`, e.message);
                }
            }
        }
    } catch (err) {
        // Silent fail
    }
}

/**
 * Iterates through all conversations that have auto-reply enabled
 * and checks if they need a proactive response.
 */
async function checkAllEnabledConvs() {
    const enabledIDs = Array.from(autoReplyState.enabledConvs);
    if (enabledIDs.length === 0) return;

    // log(`[BackgroundChecker] Checking ${enabledIDs.length} enabled conversations...`);

    for (const convID of enabledIDs) {
        try {
            const data = await getProductionMessages(convID);
            const messages = data.messages || [];
            if (messages.length === 0) continue;

            // Sort to find latest
            const sorted = messages.sort((a, b) => (a.msgTS || 0) - (b.msgTS || 0));
            const lastMsg = sorted[sorted.length - 1];

            if (!lastMsg) continue;

            const isFromOther = lastMsg.convSide === 'other';
            const msgHash = lastMsg.msgHash || lastMsg.id;
            const msgTS = lastMsg.msgTS || moment(lastMsg.date).unix();
            const now = moment().unix();
            const elapsed = now - msgTS;

            // Re-sync history for AI context if this is a fresh check or restart
            // (Only if we don't have it in memory yet, or to keep it fresh)
            const { conversationHistory } = require('./aiReply');
            if (!conversationHistory.has(convID) || conversationHistory.get(convID).length === 0) {
                const recentHistory = sorted.slice(-15).map(m => ({
                    role: m.convSide === 'mine' ? 'assistant' : 'user',
                    content: m.msgBody || m.comment || ''
                })).filter(h => h.content);

                clearHistory(convID);
                recentHistory.forEach(h => recordMessage(convID, h.role, h.content));
                log(`[BackgroundChecker] Seeded context for ${convID} (${recentHistory.length} msgs)`);
            }

            // CHECK CONDITIONS:
            // 1. Last message is from OTHER
            // 2. We haven't replied to this specific msgHash yet
            // 3. At least 15-30 seconds have passed (randomize a bit per conv)
            const checkThreshold = 15 + Math.floor(Math.random() * 15);

            if (isFromOther && autoReplyState.lastReplied.get(convID) !== msgHash && elapsed >= checkThreshold) {
                const text = lastMsg.msgBody || lastMsg.comment || '';
                const senderName = lastMsg.user?.screenName || 'User';

                log(`[BackgroundChecker] Proactive trigger for ${convID}. Elapsed: ${elapsed}s. Replying to: "${text.slice(0, 40)}..."`);

                const reply = await generateReply(convID, text, senderName);
                await sendProductionMessage(convID, reply);

                log(`[BackgroundChecker] ✅ Proactive AI reply sent for ${convID}`);

                // Move state update here so we only mark it "replied" on success
                autoReplyState.lastReplied.set(convID, msgHash);
                autoReplyState.save();

                // Emit to local UI
                const { emitToLocal } = require('../sockets/bridge');
                const msgObj = {
                    action: 'newMessage',
                    convID,
                    room: convID,
                    convSide: 'mine',
                    text: reply,
                    message: {
                        msgBody: reply,
                        msgHash: 'ai_bg_' + Math.random().toString(36).slice(2, 7),
                        msgTS: moment().unix(),
                        convID,
                        user: { screenName: 'me' }
                    },
                    timestamp: moment().unix()
                };

                emitToLocal(convID, 'recConvAction', msgObj);
            }
        } catch (err) {
            log(`[BackgroundChecker] ❌ Error checking ${convID}: ${err.message}`);
        }
    }
}

module.exports = { initBackgroundChecker };
