// server/routes/autoReply.js
const express = require('express');
const router = express.Router();
const autoReplyState = require('../config/autoReplyState');
const { generateReply, clearHistory, getHistorySize } = require('../services/aiReply');

// GET /auto-reply/status
router.get('/status', (req, res) => {
    res.json({
        enabledConvs: Array.from(autoReplyState.enabledConvs),
        autoMode: autoReplyState.autoMode
    });
});

// POST /auto-reply/toggle-mode
router.post('/toggle-mode', (req, res) => {
    const active = autoReplyState.toggleAutoMode();
    console.log(`[AutoReply] Global Auto-Mode: ${active ? '✅ ON' : '❌ OFF'}`);
    res.json({ autoMode: active });
});

// POST /auto-reply/toggle-conv  { convID }
router.post('/toggle-conv', (req, res) => {
    const { convID } = req.body;
    if (!convID) return res.status(400).json({ error: 'convID required' });
    const nowEnabled = autoReplyState.toggle(convID);
    console.log(`[AutoReply] Conv ${convID}: ${nowEnabled ? '✅ ON' : '❌ OFF'}`);
    res.json({ convID, enabled: nowEnabled });
});

// POST /auto-reply/suggest  { convID, message, senderName }
// Generate a reply suggestion but DON'T send it — return it for the user to review.
router.post('/suggest', async (req, res) => {
    const { convID, message, senderName = 'User', history = null } = req.body;
    if (!convID) return res.status(400).json({ error: 'convID required' });

    try {
        // Pass the optional history from the UI to ensure full context
        const reply = await generateReply(convID, message, senderName, history);
        res.json({ reply });
    } catch (err) {
        log(`[AutoReply] Suggest error for ${convID}: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /auto-reply/history/:convID
router.delete('/history/:convID', (req, res) => {
    clearHistory(req.params.convID);
    res.json({ cleared: true });
});

// GET /auto-reply/history/:convID
router.get('/history/:convID', (req, res) => {
    res.json({ messages: getHistorySize(req.params.convID) });
});

module.exports = router;
