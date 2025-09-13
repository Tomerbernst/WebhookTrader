const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { WEB_PORT } = require('./config');

// optional: make a logs dir next to the exe (works with pkg too)
const isPkg = typeof process.pkg !== 'undefined';
const appRoot = isPkg ? path.dirname(process.execPath) : process.cwd();
const logsDir = path.join(appRoot, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app = express();
app.use(bodyParser.json());
app.use('/webhook', routes);

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = app.listen(WEB_PORT, () => {
    console.log(`Webhook service running on port ${WEB_PORT}`);
});

// graceful stop
function shutdown(sig) {
    console.log(`${sig} received. Shutting down...`);
    try { server.close(() => process.exit(0)); } catch { process.exit(0); }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
