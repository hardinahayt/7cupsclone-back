// server/utils/logger.js
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const logFile = fs.createWriteStream(path.join(__dirname, '..', 'server.log'), { flags: 'a' });

const log = (msg) => {
    const formatted = `[${moment().format()}] ${msg}\n`;
    console.log(formatted.trim());
    logFile.write(formatted);
};

module.exports = { log };
