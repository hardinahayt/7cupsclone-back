const io = require('socket.io-client');
const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

const PROD_SOCKET_URL = 'https://chat-production.7cups.com';
const TARGET_BASE = 'https://www.7cups.com';
const cookies = process.env.SEVEN_CUPS_COOKIES || '';

async function start() {
    try {
        console.log('Fetching user identity...');
        const res = await axios.get(`${TARGET_BASE}/apiv2/chat/conversation/`, {
            headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7...'
            }
        });
        const userTypeID = res.data?.user?.userTypeID || (res.data?.me);
        console.log('Found user/member identity:', userTypeID);

        console.log('Connecting socket...');
        const socket = io(PROD_SOCKET_URL, {
            transports: ['websocket', 'polling'],
            extraHeaders: { 'Cookie': cookies }
        });

        socket.on('connect', () => {
            console.log('Connected! ID:', socket.id);
            if (userTypeID) {
                console.log('Joining room for identity:', userTypeID);
                socket.emit('addToRooms', [userTypeID]);
            }
        });

        socket.onAny((event, ...args) => {
            console.log(`[Event] ${event}`, JSON.stringify(args).slice(0, 300));
        });

        setTimeout(() => {
            console.log('Test complete.');
            process.exit(0);
        }, 15000);
    } catch (err) {
        console.error('Error:', err.message);
    }
}
start();
