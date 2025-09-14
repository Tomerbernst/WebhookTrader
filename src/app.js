// app.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { WEB_PORT } = require('./config');
const { startCloudflareTunnel } = require('./tunnel');

const isPkg = typeof process.pkg !== 'undefined';
const appRoot = isPkg ? path.dirname(process.execPath) : process.cwd();
const logsDir = path.join(appRoot, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app = express();
app.use(bodyParser.json());
app.use('/webhook', routes);

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

let PUBLIC_URL = null;

// tiny helper so you can read the public URL in a browser/console
app.get('/', (_req, res) => {
    res.type('text/plain').send(PUBLIC_URL
        ? `TradingView Webhook URL: ${PUBLIC_URL}/webhook`
        : 'Public URL is not ready yet. Check logs.');
});

const server = app.listen(WEB_PORT, async () => {
    console.log(`Webhook service running on http://localhost:${WEB_PORT}`);
    try {
        const { publicUrl } = await startCloudflareTunnel(`http://localhost:${WEB_PORT}`);
        PUBLIC_URL = publicUrl;
        console.log(`Public URL: ${PUBLIC_URL}`);
        console.log(`Use this in TradingView: ${PUBLIC_URL}/webhook`);
    } catch (e) {
        console.error('Failed to start tunnel:', e.message);
    }
});

// graceful stop
function shutdown(sig) {
    console.log(`${sig} received. Shutting down...`);
    try { server.close(() => process.exit(0)); } catch { process.exit(0); }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
