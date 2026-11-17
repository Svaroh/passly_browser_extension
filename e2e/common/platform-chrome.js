/**
 * Cross-Platform Chrome / Chromium Executable Resolver
 * Supports: Linux, macOS (darwin), Windows (win32)
 *
 * Prefers Chromium / Chrome for Testing when available because Google Chrome 137+
 * removed support for --load-extension in branded builds.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function whichBinary(name) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(cmd, [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function findChromeForTestingOnLinux() {
  const home = process.env.HOME || '';
  const bases = [
    path.join(home, '.cache/chrome-for-testing/chrome'),
    '/tmp/chrome-for-testing/chrome',
  ];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    try {
      const entries = fs.readdirSync(base).sort().reverse();
      for (const entry of entries) {
        const candidate = path.join(base, entry, 'chrome-linux64/chrome');
        if (fs.existsSync(candidate)) {
          // Verify candidate actually executes (e.g. not broken due to missing dynamic libraries in NixOS)
          try {
            execFileSync(candidate, ['--version'], { stdio: 'ignore' });
            return candidate;
          } catch {}
        }
      }
    } catch {}
  }
  return null;
}

function getChromeExecutable() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }

  // Windows
  if (process.platform === 'win32') {
    const candidates = [
      process.env['PROGRAMFILES'] ? path.join(process.env['PROGRAMFILES'], 'Google/Chrome/Application/chrome.exe') : null,
      process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe') : null,
      process.env['LOCALAPPDATA'] ? path.join(process.env['LOCALAPPDATA'], 'Google/Chrome/Application/chrome.exe') : null,
      process.env['PROGRAMFILES'] ? path.join(process.env['PROGRAMFILES'], 'Microsoft/Edge/Application/msedge.exe') : null,
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'chrome.exe';
  }

  // macOS
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  // Linux: prefer Chromium / Chrome for Testing which support --load-extension
  const cft = findChromeForTestingOnLinux();
  if (cft) return cft;

  for (const name of ['chromium', 'chromium-browser']) {
    const resolved = whichBinary(name);
    if (resolved) return resolved;
  }

  const staticCandidates = [
    '/run/current-system/sw/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  for (const c of staticCandidates) {
    if (fs.existsSync(c)) return c;
  }

  return whichBinary('google-chrome') || 'google-chrome';
}

module.exports = { getChromeExecutable };
