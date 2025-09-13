const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function logMessage(message) {
    const date = new Date();
    const logFileName = `${date.toISOString().split('T')[0]}.log`; // YYYY-MM-DD.log
    const logFilePath = path.join(logDir, logFileName);

    const timestamp = date.toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Failed to write log:', err.message);
        }
    });
}

module.exports = {
    logMessage,
};
