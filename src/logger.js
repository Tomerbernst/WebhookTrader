// src/logger.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const isPkg = typeof process.pkg !== 'undefined';
// when packaged, write next to the EXE; in dev, write in project root
const appRoot = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

const PRIMARY_DIR = path.join(appRoot, 'logs');
const FALLBACK_DIR = path.join(os.tmpdir(), 'WebhookTrader-logs');

function ensureDir(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    } catch {
        fs.mkdirSync(FALLBACK_DIR, { recursive: true });
        return FALLBACK_DIR;
    }
}

const LOG_DIR = ensureDir(PRIMARY_DIR);
const LOG_FILE = path.join(LOG_DIR, 'server.log');

function safeStr(v) {
    try { return typeof v === 'string' ? v : JSON.stringify(v); }
    catch { return String(v); }
}

function logMessage(...args) {
    const line = `[${new Date().toISOString()}] ${args.map(safeStr).join(' ')}\n`;
    try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch {}
    console.log(...args);
}

module.exports = { logMessage, LOG_DIR, LOG_FILE };
