const axios = require('axios');
const { TARGET_BASE } = require('../config/constants');
const { log } = require('./logger');

/**
 * Sends a message to the production 7 Cups API with all necessary headers
 * to avoid 403 Forbidden / Bot detection.
 */
async function sendProductionMessage(convID, text) {
    const cookies = process.env.SEVEN_CUPS_COOKIES || '';
    const targetUrl = `${TARGET_BASE}/apiv2/chat/conversation/${convID}/message`;
    const msgHash = Math.random().toString(36).substring(7);

    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Origin': 'https://www.7cups.com',
        'Referer': `https://www.7cups.com/chat/?c=${convID}`,
        'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
    };

    try {
        const response = await axios.post(targetUrl, {
            convID,
            comment: text,
            msgHash
        }, { headers });

        log(`[ProductionAPI] Payload response for ${convID}: ${JSON.stringify(response.data)}`);

        if (response.status === 200 || response.status === 201) {
            if (response.data?.ack === 'error' || response.data?.status === 'error') {
                log(`[ProductionAPI] ❌ 7Cups rejected message to ${convID}: ${JSON.stringify(response.data)}`);
            } else {
                log(`[ProductionAPI] ✅ Message sent to ${convID}`);
            }
            return response.data;
        } else {
            log(`[ProductionAPI] ⚠️ Unexpected status ${response.status} for ${convID}`);
            return response.data;
        }
    } catch (err) {
        log(`[ProductionAPI] ❌ Failed to send to ${convID}: ${err.message}`);
        throw err;
    }
}

async function getProductionMessages(convID) {
    const cookies = process.env.SEVEN_CUPS_COOKIES || '';
    const targetUrl = `${TARGET_BASE}/apiv2/chat/conversation/${convID}/message/`;

    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Origin': 'https://www.7cups.com',
        'Referer': `https://www.7cups.com/chat/?c=${convID}`,
        'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
    };

    try {
        const response = await axios.get(targetUrl, { headers });
        return response.data;
    } catch (err) {
        log(`[ProductionAPI] ❌ Failed to get messages for ${convID}: ${err.message}`);
        throw err;
    }
}

async function acceptProductionRequest(convID) {
    const cookies = process.env.SEVEN_CUPS_COOKIES || '';
    const targetUrl = `${TARGET_BASE}/apiv2/chat/conversation/${convID}/accept`;

    const headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Origin': 'https://www.7cups.com',
        'Referer': `https://www.7cups.com/chat/`
    };

    try {
        const response = await axios.post(targetUrl, {}, { headers });

        log(`[ProductionAPI] Accept response for ${convID}: ${response.status}`);
        return response.data;
    } catch (err) {
        log(`[ProductionAPI] ❌ Failed to accept ${convID}: ${err.message}`);
        throw err;
    }
}

module.exports = { sendProductionMessage, getProductionMessages, acceptProductionRequest };
