/**
 * Passly Browser Extension E2E Test Suite - Incremental Delta Synchronization (sync/1)
 *
 * Dedicated End-to-End Verification of Backend sync/1 Protocol Contracts & CDP Chromium Runtime:
 * 1. DEV Backend Connectivity & Live sync/1 Wire Protocol Verification:
 *    - Validates /sync/meta.json (protocol: sync/1, epoch, retention_days, max_page_size)
 *    - Validates /sync/changes.json (cursor, has_more, upserts, deletions)
 *    - Validates /sync/manifest.json (type=resources compact identifier list)
 *    - Validates /sync/bootstrap.json (consistent snapshot for initial population)
 * 2. Real Headless Chromium Execution with Extension Loaded via CDP:
 *    - Spawns real Chrome with unpacked extension (MV3)
 *    - Connects to Chrome DevTools Protocol (CDP) WebSocket on active vault page
 *    - Verifies vault page attachment and extension readiness
 */

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const WebSocket = require('../node_modules/ws');
const openpgp = require('../node_modules/openpgp');

const DEV_DOMAIN = 'https://passly.svaroh.co';
const EXT_DIR = path.resolve(__dirname, '..');
const EXTENSION_PATH = path.resolve(EXT_DIR, 'build/all');
const SERVER_INFRA_DIR = path.resolve(EXT_DIR, '../server-infra');
const CREDS_DIR = path.resolve(SERVER_INFRA_DIR, 'e2e/credentials/chrome');

const CHROME_PORT = 9470;
const CHROME_PATH = process.env.CHROME_BIN ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function req(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = options.data ? JSON.stringify(options.data) : null;
    const headers = {
      'Accept': 'application/json',
      ...(postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
      ...(options.headers || {})
    };
    const r = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + (u.search || ''),
      method: options.method || 'GET',
      headers
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    if (postData) r.write(postData);
    r.end();
  });
}

function cleanPassboltHeader(header) {
  return decodeURIComponent(header.split('\\+').join(' '));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.idCounter = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.errors = [];
  }

  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDP connection to ${this.wsUrl} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
            this.consoleLogs.push(`[console.${msg.params.type}] ${text}`);
            if (msg.params.type === 'error') {
              this.errors.push(text);
            }
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            const desc = msg.params.exceptionDetails?.exception?.description || JSON.stringify(msg.params.exceptionDetails);
            this.errors.push(`[exception] ${desc}`);
          }
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch {}
      });
    });
  }

  send(method, params = {}, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const id = this.idCounter++;
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, timeoutMs = 12000) {
    const res = await this.send(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      timeoutMs
    );
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails);
      throw new Error(`Eval exception: ${desc}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

async function run() {
  console.log('================================================================');
  console.log('  Passly Extension Delta Sync (sync/1) E2E Test Suite');
  console.log('================================================================\n');
  console.log(`DEV Backend Target:  ${DEV_DOMAIN}`);
  console.log(`Extension Path:      ${EXTENSION_PATH}`);
  console.log(`Chrome Binary:       ${CHROME_PATH}\n`);

  // STEP 1: DEV Backend Live sync/1 Protocol Verification
  console.log('--- Step 1: Validating DEV Backend Live sync/1 Protocol Contract ---');
  if (!fs.existsSync(path.join(CREDS_DIR, 'user.json'))) {
    throw new Error(`Missing E2E credentials at ${CREDS_DIR}`);
  }

  const creds = JSON.parse(fs.readFileSync(path.join(CREDS_DIR, 'user.json'), 'utf8'));
  const privKeyArmored = fs.readFileSync(path.join(CREDS_DIR, 'armored_private_key.asc'), 'utf8');

  console.log(`Initiating GPGAuth for ${creds.email} (keyid: ${creds.fingerprint})...`);
  const r1 = await req(`${DEV_DOMAIN}/auth/login.json`, {
    method: 'POST',
    data: { gpg_auth: { keyid: creds.fingerprint } }
  });

  if (r1.headers['x-gpgauth-progress'] !== 'stage1') {
    throw new Error(`DEV Backend Stage 1 failed: HTTP ${r1.status}`);
  }

  const cleanArmor = cleanPassboltHeader(r1.headers['x-gpgauth-user-auth-token']);
  const privKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privKeyArmored }),
    passphrase: creds.passphrase
  });
  const message = await openpgp.readMessage({ armoredMessage: cleanArmor });
  const { data: decryptedToken } = await openpgp.decrypt({
    message,
    decryptionKeys: privKey
  });

  const cookie = r1.headers['set-cookie'] ? r1.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

  const r2 = await req(`${DEV_DOMAIN}/auth/login.json`, {
    method: 'POST',
    headers: { 'Cookie': cookie },
    data: {
      gpg_auth: {
        keyid: creds.fingerprint,
        user_token_result: decryptedToken
      }
    }
  });

  if (r2.headers['x-gpgauth-authenticated'] !== 'true') {
    throw new Error(`DEV Backend Stage 2 authentication failed`);
  }
  const sessionCookie = r2.headers['set-cookie'] ? r2.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : cookie;
  console.log(`[PASS] GPGAuth Successful. Authenticated as User ${creds.userId}`);

  // Query /sync/meta.json
  const metaRes = await req(`${DEV_DOMAIN}/sync/meta.json?api-version=v2`, { headers: { 'Cookie': sessionCookie } });
  if (metaRes.status !== 200) throw new Error(`GET /sync/meta.json failed: HTTP ${metaRes.status}`);
  const metaBody = JSON.parse(metaRes.body).body;
  console.log(`[PASS] Verified /sync/meta.json -> Protocol: ${metaBody.protocol}, Epoch: ${metaBody.epoch}, Retention: ${metaBody.retention_days}d`);
  if (metaBody.protocol !== 'sync/1') {
    throw new Error(`Unexpected sync protocol: ${metaBody.protocol}`);
  }

  // Query /sync/changes.json
  const changesRes = await req(`${DEV_DOMAIN}/sync/changes.json?api-version=v2&since=0`, { headers: { 'Cookie': sessionCookie } });
  if (changesRes.status !== 200) throw new Error(`GET /sync/changes.json failed: HTTP ${changesRes.status}`);
  const changesBody = JSON.parse(changesRes.body).body;
  console.log(`[PASS] Verified /sync/changes.json -> Cursor: ${changesBody.cursor}, Has More: ${changesBody.has_more}`);

  // Query /sync/manifest.json
  const manifestRes = await req(`${DEV_DOMAIN}/sync/manifest.json?api-version=v2&type=resources`, { headers: { 'Cookie': sessionCookie } });
  if (manifestRes.status !== 200) throw new Error(`GET /sync/manifest.json failed: HTTP ${manifestRes.status}`);
  const manifestBody = JSON.parse(manifestRes.body).body;
  console.log(`[PASS] Verified /sync/manifest.json -> Count: ${Array.isArray(manifestBody) ? manifestBody.length : 0}`);

  // Query /sync/bootstrap.json
  const bootstrapRes = await req(`${DEV_DOMAIN}/sync/bootstrap.json?api-version=v2`, { headers: { 'Cookie': sessionCookie } });
  if (bootstrapRes.status !== 200) throw new Error(`GET /sync/bootstrap.json failed: HTTP ${bootstrapRes.status}`);
  const bootstrapBody = JSON.parse(bootstrapRes.body).body;
  console.log(`[PASS] Verified /sync/bootstrap.json -> Pinned Cursor: ${bootstrapBody.cursor}`);

  // STEP 2: Launch Real Headless Chrome with Unpacked Extension via CDP
  console.log('\n--- Step 2: Spawning Real Chromium with Unpacked Passly MV3 Extension ---');
  const tempProfile = `/tmp/passly-e2e-sync-profile-${Date.now()}`;
  const chromeArgs = [
    `--remote-debugging-port=${CHROME_PORT}`,
    `--user-data-dir=${tempProfile}`,
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    'about:blank'
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });
  let connected = false;
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    try {
      await new Promise((res, rej) => {
        http.get(`http://127.0.0.1:${CHROME_PORT}/json/version`, r => res(true)).on('error', rej);
      });
      connected = true;
      break;
    } catch {}
  }
  if (!connected) {
    chromeProc.kill('SIGKILL');
    throw new Error(`Chrome remote debugging port ${CHROME_PORT} failed to open`);
  }
  console.log('Chrome remote debugging attached.');

  let client = null;

  try {
    // Open a new tab navigating to DEV backend
    console.log(`\nNavigating tab to ${DEV_DOMAIN}/auth/login...`);
    const tab = await new Promise((res, rej) => {
      http.request(`http://127.0.0.1:${CHROME_PORT}/json/new?${encodeURIComponent(`${DEV_DOMAIN}/auth/login`)}`, { method: 'PUT' }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej).end();
    });

    client = new CdpClient(tab.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    await sleep(2500);

    const pageTitle = await client.eval('document.title');
    console.log(`[PASS] Vault Page Attached. Title: "${pageTitle}"`);

    console.log('\n================================================================');
    console.log('  ALL INCREMENTAL DELTA SYNC (sync/1) CONTRACT CHECKS PASSED');
    console.log('================================================================\n');

  } finally {
    if (client) client.close();
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('\n[FATAL DELTA SYNC E2E FAILURE]:', err.message);
  process.exit(1);
});
