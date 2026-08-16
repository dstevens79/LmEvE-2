// LmEvE-2 deploy: gzip dist locally -> chunked base64 over SSH exec -> tar extract on server.
// Usage:  $env:LMEVE_PASS='<password>'; node scripts/deploy-lmeve.js
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const HOST = '24.128.239.249';
const USER = 'dstevens';
const PASS = process.env.LMEVE_PASS || '';
const ROOT = '/var/www/html/lmeve2';
const LOCAL_DIST = path.join(__dirname, '..', 'dist');

if (!PASS) { console.error('LMEVE_PASS env not set'); process.exit(1); }

function run(conn, cmd) {
  return new Promise((res, rej) => conn.exec(cmd, (e, s) => {
    if (e) return rej(e);
    let o = '';
    s.on('data', (d) => (o += d));
    s.stderr.on('data', (d) => (o += '[stderr] ' + d));
    s.on('close', (c) => res({ code: c, out: o.trim() }));
  }));
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    const tgz = path.join(__dirname, 'lmeve-dist.tgz');
    await new Promise((res, rej) => execFile(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-czf', tgz, '-C', LOCAL_DIST, '.'], (e, so, se) => e ? rej(new Error('tar: ' + (se || e.message))) : res()));
    const b64 = fs.readFileSync(tgz).toString('base64');
    console.log(`payload ${(b64.length / 1024).toFixed(0)}KB base64`);

    await run(conn, `rm -f /tmp/lmeve.b64`);
    const CHUNK = 8000;
    for (let i = 0; i < b64.length; i += CHUNK) {
      const r = await run(conn, `printf '%s' '${b64.slice(i, i + CHUNK)}' >> /tmp/lmeve.b64`);
      if (r.code !== 0 || /[stderr]/.test(r.out)) throw new Error(`chunk ${i / CHUNK} failed: ${r.out.slice(0, 200)}`);
    }

    const r = await run(conn, `base64 -d /tmp/lmeve.b64 > /tmp/lmeve.tgz && echo '${PASS}' | sudo -S bash -c "rm -rf ${ROOT}/assets; tar xzf /tmp/lmeve.tgz -C ${ROOT}; chmod -R a+rX ${ROOT}/assets ${ROOT}/index.html" 2>&1`);
    if (r.code !== 0) throw new Error('extract failed: ' + r.out.slice(0, 400));

    await run(conn, `rm -f /tmp/lmeve.b64 /tmp/lmeve.tgz ${tgz}`);

    const v = await run(conn, `ls ${ROOT}/assets | wc -l; ls -la ${ROOT}/index.html | awk '{print $1,$3,$5}'; grep -o 'vendor-[A-Za-z0-9_-]*\\.js' ${ROOT}/index.html`);
    console.log('DEPLOY OK');
    console.log(v.out);
  } catch (e) {
    console.error('DEPLOY FAILED:', String(e.message).slice(0, 500));
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).on('error', (e) => { console.error('CONNECT ERR:', e.message); process.exit(2); })
 .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
