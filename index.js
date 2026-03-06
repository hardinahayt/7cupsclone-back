require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const { TARGET_BASE } = require('./config/constants');
const { proxyRequest } = require('./routes/proxy');
const { setupWebSockets } = require('./sockets/bridge');
const autoReplyRouter = require('./routes/autoReply');


const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Attach IO to request for proxy access
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Express 5 Prefix Matching: Routes
app.use('/apiv2', proxyRequest);
app.use('/ajax', proxyRequest);
app.use('/connect', proxyRequest);
app.use('/BrowseListeners', proxyRequest);
app.use('/auto-reply', autoReplyRouter);


app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'Proxy Server Active',
        target: TARGET_BASE,
        hasEnvCookies: !!process.env.SEVEN_CUPS_COOKIES
    });
});

// Setup WebSockets
setupWebSockets(io);

// Start Background Auto-Reply Checker
const { initBackgroundChecker } = require('./services/backgroundChecker');
initBackgroundChecker(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Production Proxy Server running on port ${PORT}`);
    console.log(`Targeting: ${TARGET_BASE}`);
});
