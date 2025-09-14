// tunnel.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolveCloudflaredPath() {
    const isWin = process.platform === 'win32';
    const isPkg = typeof process.pkg !== 'undefined';
    const appDir = isPkg ? path.dirname(process.execPath) : process.cwd();

    // 1) prefer sidecar next to EXE / project root
    const sidecar = path.join(appDir, isWin ? 'cloudflared.exe' : 'cloudflared');
    if (fs.existsSync(sidecar)) return sidecar;

    // 2) fallback to PATH for dev machines
    return isWin ? 'cloudflared.exe' : 'cloudflared';
}

function startCloudflareTunnel(localUrl = 'http://localhost:3000') {
    return new Promise((resolve, reject) => {
        const exePath = resolveCloudflaredPath();

        const proc = spawn(exePath, [
            'tunnel',
            '--url', localUrl,
            '--no-autoupdate',
            '--loglevel', 'info'
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        let publicUrl = null;

        const sniff = (buf) => {
            const s = buf.toString();
            const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
            if (m && !publicUrl) {
                publicUrl = m[0];
                resolve({ publicUrl, proc });
            }
        };

        proc.stdout.on('data', sniff);
        proc.stderr.on('data', sniff);
        proc.on('error', reject);
        proc.on('exit', (code) => {
            if (!publicUrl) reject(new Error(`cloudflared exited early (code ${code})`));
        });
    });
}

module.exports = { startCloudflareTunnel };
