const fs = require('fs');
const path = require('path');

// Define the log directory
const logDir = path.join(__dirname, 'logs');

// Ensure the log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function logMessage(message) {
    const date = new Date();
    const logFileName = `${date.toISOString().split('T')[0]}.log`; // YYYY-MM-DD.log
    const logFilePath = path.join(logDir, logFileName);

    const timestamp = date.toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // Append the log entry to the file
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Failed to write log:', err.message);
        }
    });
}

module.exports = {
    logMessage,
};
