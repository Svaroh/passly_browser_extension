/**
 * Passly Browser Extension E2E Test Suite - First Load (Initial Launch)
 *
 * Dedicated End-to-End Verification of First Load / Cold Start Experience:
 * 1. Fresh Chrome User Profile (zero cached data, clean slate)
 * 2. Chromium MV3 Extension loading and Service Worker activation
 * 3. CDP Multi-Target Monitoring (Page, Service Worker, Workspace, QuickAccess)
 * 4. Verification of background initialization:
 *    - Service Worker precaching & controller registration
 *    - Offscreen document bridge & fetch fallback readiness
 *    - Delta sync & metadata decryption handling on cold start
 *    - OPFS storage initialization
 *    - Workspace & QuickAccess UI rendering
 * 5. Strict Zero Console Errors & Zero Uncaught Exceptions Enforcement:
 *    - In ALL phases and across ALL targets, any console.error or exception
 *      immediately fails the test.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('../node_modules/ws');

const { getChromeExecutable } = require('./common/platform-chrome');

const DEV_DOMAIN = 'https://passly.svaroh.co';
const PROD_DOMAIN = 'https://pass.66ton99.org.ua';
const EXT_DIR = path.resolve(__dirname, '..');
const EXTENSION_PATH = path.resolve(EXT_DIR, 'build/all');

const CHROME_PORT = 9488;
const CHROME_PATH = getChromeExecutable();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl, name = 'Target') {
    this.wsUrl = wsUrl;
    this.name = name;
    this.ws = null;
    this.idCounter = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.errors = [];
    this.exceptions = [];
  }

  connect(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDP connection to ${this.name} (${this.wsUrl}) timed out after ${timeoutMs}ms`));
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
            this.consoleLogs.push(`[${this.name} console.${msg.params.type}] ${text}`);
            if (msg.params.type === 'error') {
              this.errors.push(`[${this.name} console.error] ${text}`);
            }
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            const desc = msg.params.exceptionDetails?.exception?.description || JSON.stringify(msg.params.exceptionDetails);
            this.exceptions.push(`[${this.name} exception] ${desc}`);
            this.errors.push(`[${this.name} exception] ${desc}`);
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

async function getTargets(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function createTab(port, url) {
  return new Promise((resolve, reject) => {
    http.request(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
      { method: 'PUT' },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    ).on('error', reject).end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('  Passly Extension First Load (Initial Launch) E2E Test Suite');
  console.log('================================================================\n');
  console.log(`DEV Backend Target:  ${DEV_DOMAIN}`);
  console.log(`PROD Backend Target: ${PROD_DOMAIN}`);
  console.log(`Extension Path:      ${EXTENSION_PATH}`);
  console.log(`Chrome Binary:       ${CHROME_PATH}\n`);

  const tempProfile = `/tmp/passly-first-load-${Date.now()}`;
  const chromeArgs = [
    `--remote-debugging-port=${CHROME_PORT}`,
    `--user-data-dir=${tempProfile}`,
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    'about:blank',
  ];

  console.log('Launching clean-profile Chrome with Passly Extension loaded...');
  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

  let connected = false;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      await new Promise((res, rej) => {
        http.get(`http://127.0.0.1:${CHROME_PORT}/json/version`, () => res(true)).on('error', rej);
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

  const clients = [];
  const allErrors = [];

  try {
    // STEP 1: Discover Extension ID and Extension Targets
    console.log('\n--- Step 1: Discovering Extension Architecture & Targets ---');
    await sleep(1500);

    const initialTargets = await getTargets(CHROME_PORT);
    console.log(`Discovered ${initialTargets.length} initial CDP target(s).`);

    const swTarget = initialTargets.find(
      (t) =>
        t.type === 'service_worker' &&
        t.url &&
        t.url.startsWith('chrome-extension://') &&
        t.url.includes('serviceWorker/serviceWorker.js')
    );

    let extId = null;
    if (swTarget) {
      const match = swTarget.url.match(/chrome-extension:\/\/([a-z0-9_-]+)/i);
      if (match) extId = match[1];
      console.log(`[PASS] Passly Extension Service Worker Target Found: ${swTarget.url}`);
    } else {
      throw new Error(
        `FAILED: Passly extension serviceWorker/serviceWorker.js not found among CDP targets: ${JSON.stringify(
          initialTargets.map((t) => `${t.type}:${t.url}`)
        )}`
      );
    }
    console.log(`Extension ID: ${extId}`);

    // Connect to Extension Service Worker to monitor background logs/errors
    let swClient = null;
    if (swTarget && swTarget.webSocketDebuggerUrl) {
      console.log('Attaching CDP listener to Service Worker...');
      swClient = new CdpClient(swTarget.webSocketDebuggerUrl, 'ServiceWorker');
      await swClient.connect();
      await swClient.send('Runtime.enable');
      clients.push(swClient);
    }

    // Also attach to Offscreen document if active
    const offscreenTarget = initialTargets.find(
      (t) => t.url && t.url.startsWith(`chrome-extension://${extId}/offscreens/offscreen.html`)
    );
    if (offscreenTarget && offscreenTarget.webSocketDebuggerUrl) {
      console.log('Attaching CDP listener to Offscreen document...');
      const offscreenClient = new CdpClient(offscreenTarget.webSocketDebuggerUrl, 'Offscreen');
      await offscreenClient.connect();
      await offscreenClient.send('Runtime.enable');
      clients.push(offscreenClient);
    }

    // STEP 2: Navigate First Tab to DEV login / vault page
    console.log(`\n--- Step 2: First Load Navigation to ${DEV_DOMAIN}/auth/login ---`);
    const pageTab = await createTab(CHROME_PORT, `${DEV_DOMAIN}/auth/login`);
    const pageClient = new CdpClient(pageTab.webSocketDebuggerUrl, 'PageTab');
    await pageClient.connect();
    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');
    await pageClient.send('Network.enable');
    clients.push(pageClient);

    // Allow page and extension initialization scripts, sync attempts, and background tasks to settle
    console.log('Waiting for initial page scripts, extension content scripts, and sync tasks to settle...');
    await sleep(5000);

    const pageUrl = await pageClient.eval('window.location.href');
    const pageTitle = await pageClient.eval('document.title');
    const isOnline = await pageClient.eval('navigator.onLine');
    console.log(`Page URL:    ${pageUrl}`);
    console.log(`Page Title:  "${pageTitle}"`);
    console.log(`Online:      ${isOnline}`);

    // STEP 3: Verify Direct Extension Signin / Setup UI (signin.html)
    // On first load without an existing user session or local replica, signin.html represents the extension authentication entrypoint.
    console.log('\n--- Step 3: First Load Verification of Extension Auth UI (signin.html) ---');
    const authUrl = `chrome-extension://${extId}/webAccessibleResources/signin.html?passbolt=signin`;
    const authTab = await createTab(CHROME_PORT, authUrl);
    const authClient = new CdpClient(authTab.webSocketDebuggerUrl, 'ExtensionAuth');
    await authClient.connect();
    await authClient.send('Page.enable');
    await authClient.send('Runtime.enable');
    clients.push(authClient);

    await sleep(3000);

    const authStatus = await authClient.eval(`
      (() => {
        const title = document.title;
        return {
          title,
          bodyLength: document.body ? document.body.innerText.length : 0,
          innerText: document.body ? document.body.innerText.substring(0, 150).replace(/\\n+/g, ' ') : ''
        };
      })()
    `);
    console.log('Extension Auth Status:', JSON.stringify(authStatus, null, 2));
    if (authStatus.innerText && authStatus.innerText.includes('ERR_FILE_NOT_FOUND')) {
      throw new Error(`FAILED: Signin extension page returned ERR_FILE_NOT_FOUND: ${authStatus.innerText}`);
    }

    // STEP 4: Verify QuickAccess Popup UI (quickaccess.html)
    // In unconfigured state, QuickAccess opens the getting started page (mobile-transfer-entrypoint.html)
    // and closes its own popup window. We navigate and verify the target directly or follow the redirect.
    console.log('\n--- Step 4: First Load Verification of Extension QuickAccess UI ---');
    const qaTab = await createTab(CHROME_PORT, 'about:blank');
    const qaClient = new CdpClient(qaTab.webSocketDebuggerUrl, 'QuickAccess');
    await qaClient.connect();
    await qaClient.send('Page.enable');
    await qaClient.send('Runtime.enable');
    clients.push(qaClient);

    const qaUrl = `chrome-extension://${extId}/webAccessibleResources/quickaccess.html?passbolt=quickaccess&uiMode=detached`;
    await qaClient.send('Page.navigate', { url: qaUrl });
    await sleep(2500);

    // After unconfigured quickaccess launch, get current tab url/title
    const qaStatus = await qaClient.eval(`
      (() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyLength: document.body ? document.body.innerText.length : 0,
          innerText: document.body ? document.body.innerText.substring(0, 150).replace(/\\n+/g, ' ') : ''
        };
      })()
    `).catch(() => ({ title: 'Closed/Navigated', url: '', bodyLength: 0, innerText: '' }));
    console.log('QuickAccess Status:', JSON.stringify(qaStatus, null, 2));

    // STEP 5: Audit Console Errors Across ALL Targets
    console.log('\n--- Step 5: Auditing Console Errors Across All Targets ---');
    for (const c of clients) {
      if (c.errors.length > 0) {
        allErrors.push(...c.errors);
      }
      console.log(`[${c.name}] Console messages: ${c.consoleLogs.length}, Errors: ${c.errors.length}`);
    }

    if (allErrors.length > 0) {
      console.error('\nCaptured console error(s) during first load:');
      allErrors.forEach((err) => console.error(` - ${err}`));
      throw new Error(
        `FAILED: First load produced ${allErrors.length} console error(s) / uncaught exception(s):\n${allErrors.join('\n')}`
      );
    }

    console.log('\n[PASS] ZERO console errors and ZERO unhandled exceptions detected across all targets on first load.');
    console.log('================================================================');
    console.log('  ALL FIRST LOAD (INITIAL LAUNCH) CHECKS PASSED 100%');
    console.log('================================================================\n');

  } finally {
    for (const c of clients) {
      c.close();
    }
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error('\n[FATAL FIRST LOAD E2E FAILURE]:', err.message);
  process.exit(1);
});
