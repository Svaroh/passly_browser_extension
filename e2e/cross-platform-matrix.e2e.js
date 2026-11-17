/**
 * Passly Extension Cross-Platform Matrix Test Suite
 * Validates extension & backend functionality across Windows, Linux & MAC.
 *
 * Requirements:
 *  - Windows: Verified via BrowserStack Automate (Windows 11 / Chrome)
 *  - MAC: Verified via BrowserStack Automate (macOS Sonoma / Chrome)
 *  - Linux: Verified via Native Headless Chrome CDP (clean profile, multi-target audit)
 *  - In ALL platforms, asserts ZERO console errors and unhandled exceptions.
 *  - ANY console error or unhandled exception immediately fails the test.
 */

const { spawn } = require('child_process');
const path = require('path');

const EXT_DIR = path.resolve(__dirname, '..');
const BS_RUNNER = path.resolve(EXT_DIR, '../server-infra/e2e/browserstack/run-browserstack-web.js');
const FIRST_LOAD_TEST = path.resolve(__dirname, 'first-load.e2e.js');

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} ${args.join(' ')} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  console.log('================================================================');
  console.log('  Passly Cross-Platform Matrix E2E Test Suite');
  console.log('  Target Platforms: Windows, Linux & MAC');
  console.log('================================================================\n');

  const args = process.argv.slice(2);
  let requestedPlatform = 'all';
  for (const a of args) {
    if (a.startsWith('--platform=')) {
      requestedPlatform = a.split('=')[1].toLowerCase();
    }
  }

  const platforms = requestedPlatform === 'all'
    ? ['linux', 'windows', 'mac']
    : [requestedPlatform];

  console.log(`Executing platforms: ${platforms.map(p => p.toUpperCase()).join(', ')}\n`);

  for (const p of platforms) {
    console.log(`\n>>> STARTING VALIDATION FOR PLATFORM: ${p.toUpperCase()} <<<`);
    if (p === 'linux') {
      // Run Linux native clean-profile CDP test suite with 0 console errors
      await runCommand('node', [FIRST_LOAD_TEST]);
    } else if (p === 'windows') {
      // Run Windows 11 BrowserStack Automate session with 0 console errors
      await runCommand('node', [BS_RUNNER, '--platform=windows']);
    } else if (p === 'mac') {
      // Run macOS Sonoma BrowserStack Automate session with 0 console errors
      await runCommand('node', [BS_RUNNER, '--platform=mac']);
    } else {
      throw new Error(`Unsupported platform: ${p}`);
    }
    console.log(`>>> PLATFORM ${p.toUpperCase()} PASSED 100% (ZERO CONSOLE ERRORS) <<<\n`);
  }

  console.log('================================================================');
  console.log('  ALL PLATFORMS (WINDOWS, LINUX & MAC) PASSED 100%');
  console.log('  ZERO CONSOLE ERRORS CONFIRMED ACROSS ALL PLATFORMS');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n[FATAL ERROR in Cross-Platform Matrix]:', err.message);
  process.exit(1);
});
