// server/services/aiReply.js
// Tries Groq first (free, fast, no install), falls back to local Ollama if available.

const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// Per-conversation history: { [convID]: [{ role, content }] }
const conversationHistory = new Map();

const SYSTEM_PROMPT = `You are Prateek, a 25-year-old Flutter developer living in Ahmedabad. 
You are talking casually to a friend on the 7 Cups platform.
Guidelines:
- Talk like a normal human friend. Use simple, everyday English.
- YOU MUST ONLY SPEAK IN ENGLISH. Never use any other language or regional slang from other languages.
- Only tell users about yourself (your name, job, age, or location) if they specifically ask for it. Don't volunteer this info otherwise.
- Avoid being "ready to help" or overly formal. Just be there for them.
- Keep replies short and sweet (1-3 sentences).
- If they share something heavy, be warm and just listen.
- Use lowercase occasionally or casual punctuation to feel more "chat-like" (e.g., "yeah", "i see", "oh wow").
- Don't start every message with "I'm here for you" or "I understand". Just talk.
- NEVER give medical/legal advice.
- ONLY reply if the person just messaged you and is waiting for a response.`;

function recordMessage(convID, role, content) {
    if (!conversationHistory.has(convID)) conversationHistory.set(convID, []);
    const history = conversationHistory.get(convID);
    history.push({ role, content });
    if (history.length > 20) history.splice(0, history.length - 20);
}

async function callGroq(messages) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('No GROQ_API_KEY in .env');

    const res = await axios.post(GROQ_URL, {
        model: GROQ_MODEL,
        messages,
        max_tokens: 200,
        temperature: 0.75,
    }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 15000
    });

    return res.data.choices?.[0]?.message?.content?.trim();
}

async function callOllama(messages) {
    const res = await axios.post(OLLAMA_URL, {
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.75, num_predict: 200 }
    }, { timeout: 30000 });
    return res.data?.message?.content?.trim();
}

async function generateReply(convID, incomingMessage, senderName = 'User', historyOverride = null) {
    if (!conversationHistory.has(convID)) conversationHistory.set(convID, []);
    let history = conversationHistory.get(convID);

    if (historyOverride && Array.isArray(historyOverride)) {
        // Use the override history provided (likely from the UI)
        // If the last message in historyOverride is the same as incomingMessage, prioritize the override's structure
        history = historyOverride;
        conversationHistory.set(convID, history);
        console.log(`[AI Reply] Applied history override for ${convID}. Length: ${history.length}`);
    } else {
        // If incomingMessage is provided and NOT the same as the last message in history, record it
        const lastMsg = history[history.length - 1];
        if (incomingMessage && (!lastMsg || lastMsg.content !== incomingMessage)) {
            history.push({ role: 'user', content: incomingMessage });
        }
    }

    if (history.length > 20) history.splice(0, history.length - 20);

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
    console.log(`[AI Reply] Messages for LLM (including system): ${messages.length}. Last role: ${messages[messages.length - 1].role}`);

    let reply;
    // Try Groq first, fall back to Ollama
    try {
        reply = await callGroq(messages);
        console.log(`[AI Reply] Used Groq for conv ${convID}`);
    } catch (groqErr) {
        console.warn(`[AI Reply] Groq failed (${groqErr.message}), trying Ollama...`);
        try {
            reply = await callOllama(messages);
            console.log(`[AI Reply] Used Ollama for conv ${convID}`);
        } catch (ollamaErr) {
            throw new Error(`Both AI backends failed. Groq: ${groqErr.message}. Ollama: ${ollamaErr.message}`);
        }
    }

    if (!reply) throw new Error('Empty response from AI');
    history.push({ role: 'assistant', content: reply });
    return reply;
}

function clearHistory(convID) { conversationHistory.delete(convID); }
function getHistorySize(convID) { return conversationHistory.get(convID)?.length || 0; }

module.exports = { generateReply, clearHistory, getHistorySize, recordMessage, conversationHistory };
