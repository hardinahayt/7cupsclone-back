const axios = require('axios');
const qs = require('qs');
const { TARGET_BASE } = require('../config/constants');
const identity = require('../config/identity');
const { log } = require('../utils/logger');
const autoReplyState = require('../config/autoReplyState');
const { generateReply, recordMessage, clearHistory } = require('../services/aiReply');
const { sendProductionMessage } = require('../utils/productionApi');
const { emitToLocal, getLocalIo } = require('../sockets/bridge');
const moment = require('moment');


// Generic Proxy Middleware for /apiv2 and /ajax
const proxyRequest = async (req, res) => {
    const targetUrl = `${TARGET_BASE}${req.originalUrl}`;
    log(`Proxying ${req.method} ${req.originalUrl} to ${targetUrl}`);
    // Force use of the backend env cookies, as the localhost browser cookies are causing 403 Forbidden
    const cookies = process.env.SEVEN_CUPS_COOKIES || '';

    if (!cookies) {
        log('  Warning: No cookies found in request or .env');
    }

    const headers = {
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': req.headers['accept-language'] || 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Origin': 'https://www.7cups.com',
        'Referer': req.headers['referer'] || `https://www.7cups.com/chat/?c=${req.params.convID || ''}`,
        'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        headers['Content-Type'] = req.headers['content-type'] || 'application/json';
    }

    try {
        const isFormEncoded = req.headers['content-type']?.includes('application/x-www-form-urlencoded');
        const proxyData = isFormEncoded ? qs.stringify(req.body) : req.body;

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: proxyData,
            headers: headers,
            validateStatus: () => true // Allow all status codes
        });

        log(`  Target Responded: ${response.status}`);

        // Scrape and save identity credentials from responses
        if (req.originalUrl.includes('/apiv2/chat/conversation')) {
            let updates = {};

            // Extract general user details like requestQueFilter if available
            if (response.data && response.data.user) {
                if (response.data.user.screenName) updates.proxyScreenName = response.data.user.screenName;
                if (response.data.user.userTypeID) updates.proxyUserTypeID = response.data.user.userTypeID;
                if (response.data.user.requestQueFilter) updates.requestQueFilter = response.data.user.requestQueFilter;
            }

            if (response.data && response.data.conversations && response.data.conversations.length > 0) {
                const firstConv = response.data.conversations[0];
                if (firstConv.user && !updates.proxyScreenName) {
                    updates.proxyScreenName = firstConv.user.screenName || identity.proxyScreenName || 'me';
                    updates.proxyUserTypeID = firstConv.user.userTypeID || firstConv.userTypeID;
                }
                if (firstConv.me) {
                    updates.proxyMeToken = firstConv.me;
                }
            }
            if (response.data && response.data.me) {
                updates.proxyMeToken = response.data.me;
            }
            identity.updateIdentity(updates);

            // --- AUTO-MODE FALLBACK (HTTP Polling) ---
            log(`[AutoMode-Fallback] Triggered. autoMode: ${autoReplyState.autoMode}, conversations: ${response.data?.conversations?.length || 0}`);
            if (autoReplyState.autoMode && response.data && response.data.conversations) {
                const requests = response.data.conversations;
                const autoAcceptTypes = ['general', 'personal'];
                const eligible = requests.filter(c =>
                    autoAcceptTypes.includes(c.reqType) &&
                    c.reqStatus === 'link'
                );

                if (eligible.length > 0) {
                    log(`[AutoMode-Fallback] 🚀 Detected ${eligible.length} eligible requests via HTTP. Processing...`);
                    eligible.forEach(async (req) => {
                        try {
                            log(`[AutoMode-Fallback] ⚡ Auto-accepting ${req.convID} (Type: ${req.reqType}, User: ${req.otherScreenName})...`);
                            const { acceptProductionRequest } = require('../utils/productionApi');
                            await acceptProductionRequest(req.convID);

                            log(`[AutoMode-Fallback] 🤖 Enabling AI auto-reply for ${req.convID}...`);
                            autoReplyState.enable(req.convID);

                            // Notify local UI to refresh
                            if (req.io) {
                                req.io.emit('recConvAction', { action: 'refreshConversations', timestamp: moment().unix() });
                            }
                        } catch (err) {
                            log(`[AutoMode-Fallback] ❌ Error processing ${req.convID}: ${err.message}`);
                        }
                    });
                }
            }
        }

        if (req.originalUrl.match(/\/apiv2\/user\//)) {
            const ud = response.data;
            log(`[USER_PROFILE] Keys: ${Object.keys(ud || {}).join(', ')}`);
            log(`[USER_PROFILE] gender=${ud?.gender}, age=${ud?.age}, country=${ud?.country}, countryCode=${ud?.countryCode}, countryFlag=${ud?.countryFlag}, CountryFull=${ud?.CountryFull}, languages=${JSON.stringify(ud?.languages)}, memberLanguages=${JSON.stringify(ud?.memberLanguages)}`);
        }
        // ── Auto-record history when messages are fetched ──
        const msgListMatch = req.originalUrl.match(/\/apiv2\/chat\/conversation\/([^/]+)\/message\/?(\?.*)?$/);
        if (req.method === 'GET' && msgListMatch && response.data?.messages) {
            const convID = msgListMatch[1];
            const msgs = response.data.messages;
            // Clear and re-populate to ensure fresh/correct order
            const history = msgs
                .sort((a, b) => (a.msgTS || 0) - (b.msgTS || 0))
                .map(m => ({
                    role: m.convSide === 'mine' ? 'assistant' : 'user',
                    content: m.msgBody || m.comment || ''
                }))
                .filter(h => h.content)
                .slice(-20); // Keep last 20

            if (history.length > 0) {
                clearHistory(convID);
                history.forEach(h => recordMessage(convID, h.role, h.content));
                log(`[AI-Sync] 📚 Seeded history for ${convID} with ${history.length} messages.`);
            }
        }

        // ── Auto-reply: intercept bot (Noni) response POSTs ──
        const sendMsgMatch = req.originalUrl.match(/\/apiv2\/chat\/conversation\/([^/]+)\/message\/?$/);
        const sendConvID = sendMsgMatch?.[1];

        // ── Request Queue & Acceptance Logging ──
        if (req.originalUrl.includes('/apiv2/chat/request/')) {
            log(`[Queue] Fetching request queue. Status: ${response.status}`);
        }
        if (req.originalUrl.includes('/accept')) {
            log(`[Accept] Request accepted for ${req.originalUrl}. Status: ${response.status}`);
            log(`[Accept] Response Body: ${JSON.stringify(response.data)}`);
            if (req.io && response.status === 200) {
                // Notify local UI to refresh conversations if needed
                req.io.emit('recConvAction', { action: 'refreshConversations', timestamp: moment().unix() });
            }
        }

        if (req.method === 'POST' && sendConvID) {
            const botMsgs = response.data?.bot || [];
            if (botMsgs.length > 0) {
                // 1. ALWAYS record Noni's responses to AI history immediately for context
                botMsgs.forEach(bm => {
                    const msg = bm.msgBody || '';
                    recordMessage(sendConvID, 'user', msg);

                    // Emit to local UI for real-time update
                    emitToLocal(sendConvID, 'recConvAction', {
                        action: 'newMessage',
                        convID: sendConvID,
                        room: sendConvID,
                        convSide: 'other',
                        text: msg,
                        message: {
                            msgBody: msg,
                            msgHash: bm.msgHash || ('bot_' + Math.random().toString(36).slice(2, 7)),
                            msgTS: bm.msgTS || moment().unix(),
                            convID: sendConvID,
                            user: { screenName: 'Noni' }
                        },
                        timestamp: bm.msgTS || moment().unix(),
                        screenName: 'Noni'
                    });
                });

                log(`[UI-Sync] 🤖 Bot messages found: ${botMsgs.length}. Recorded and emitted.`);

                // 2. ONLY trigger AI auto-reply if enabled
                if (autoReplyState.isEnabled(sendConvID)) {
                    (async () => {
                        try {
                            const lastBotMsg = botMsgs[botMsgs.length - 1];
                            const botText = lastBotMsg?.msgBody || '';
                            if (!botText) return;

                            const delay = 15000 + Math.random() * 15000;
                            log(`[AutoReply-Noni] Waiting ${Math.round(delay / 1000)}s before replying to Noni in ${sendConvID}...`);
                            await new Promise(r => setTimeout(r, delay));

                            const reply = await generateReply(sendConvID, botText, 'Noni');
                            await sendProductionMessage(sendConvID, reply);

                            // Emit AI reply back to local UI
                            emitToLocal(sendConvID, 'recConvAction', {
                                action: 'newMessage',
                                convID: sendConvID,
                                room: sendConvID,
                                convSide: 'mine',
                                text: reply,
                                message: {
                                    msgBody: reply,
                                    msgHash: 'ai_' + Math.random().toString(36).slice(2, 7),
                                    msgTS: moment().unix(),
                                    convID: sendConvID,
                                    user: { screenName: 'me' }
                                },
                                timestamp: moment().unix(),
                                screenName: 'me'
                            });

                            log(`[AutoReply] ✅ Replied to Noni in ${sendConvID}: "${reply.slice(0, 60)}"`);
                        } catch (e) {
                            log(`[AutoReply] ❌ Error responding to Noni: ${e.message}`);
                        }
                    })();
                }
            }
        }

        // Forward set-cookie headers if any
        if (response.headers['set-cookie']) {
            res.set('set-cookie', response.headers['set-cookie']);
        }

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`  Proxy Error: ${error.message}`);
        res.status(500).json({ error: 'Proxy Request Failed', message: error.message });
    }
};

module.exports = { proxyRequest };


