# Passly Browser Extension Notes

This checkout uses the `Svaroh/passly_browser_extension` fork as `origin`.
The previous upstream-derived fork remote is `legacy-66ton99`, currently
`66Ton99/passbolt_browser_extension`. The primary local and GitHub default
branch is `main` unless the user explicitly asks for another branch.

This file provides agent guidance for the Passly Browser Extension codebase.

## Repository Context

- Stack: JavaScript/React browser extension with Grunt, Webpack, Jest, ESLint,
  and browser-specific targets for Chrome, Chrome MV3, Firefox, and Safari.
- Main source areas:
  - `src/all/` for shared application, background-page, model, service,
    localization, and web-accessible resource code.
  - `src/chrome-mv3/` for MV3 service worker, offscreen, and content-script
    integration code.
  - `src/chrome/`, `src/firefox/`, and `src/safari/` for browser-specific
    manifests and runtime code.
  - `test/` for shared mocks and test helpers.
- Build and packaging scripts live in `Gruntfile.js`, the `webpack*.config.js`
  files, and `scripts/`.
- Key capabilities:
  - Containerized local workspace (`workspace.html`).
  - Offline-first session unlock and local secret persistence.
  - WebCrypto cryptography and biometric unlock.
  - Chrome MV3 PassKey provider integration and offscreen bridge.
- Testing & validation: Jest for unit tests, lockfile-lint, ESLint, and
  Playwright for offline workspace verification (`test/offline/verifyOfflineWorkspace.js`).

## Passly / Upstream Notes

- This repository is a Svaroh-maintained Passly fork of
  `passbolt/passbolt_browser_extension`.
- Keep historical upstream Passbolt copyright, license, and trademark notices
  in files that are derived from or modified from upstream Passbolt code.
- For new files that are fully Passly/Svaroh-authored, use the Passly/Svaroh
  copyright header, including `@link https://passly.svaroh.net Passly`. Do not
  copy the Passbolt SA copyright header into new Passly-owned files.
- Do not add or invent `PB-` / Passbolt ticket prefixes in new Passly release
  notes, changelog entries, commit summaries, or deployment summaries. Existing
  historical upstream Passbolt changelog entries may keep their original IDs.

## Common Commands

Use commands from `passly_browser_extension/`.

```bash
npm ci
npm run build && npm run build:chromium-mv3 && rsync -a --delete build/all/ build/chromium-mv3-unpacked/
npm run lint
npm run test:unit
grunt build
```

Narrower commands that are often useful:

```bash
npm run build:service-worker
npm run build:content-scripts
npm run build:web-accessible-resources
npm run test:coverage
npm run lint:eslint
npm run lint:lockfile
```

The unit-test script runs `node scripts/rebrand-passly-styleguide.js` before
Jest. Do not remove that step when debugging tests unless you are specifically
testing the rebrand script itself.

## Mandatory Version Bumping & Release Hygiene

- **Every change requires a version bump:** Whenever you implement a bugfix,
  feature, or behavior change, you MUST bump the extension version (patch version
  by default, e.g. `6.1.4` -> `6.1.5`) BEFORE concluding your work and presenting
  results. Never deliver code changes or bugfixes under an already existing or
  previously built version.
- **Update all version sources in lockstep:**
  1. `package.json`
  2. `package-lock.json`
  3. All browser manifests:
     - `src/chrome-mv3/manifest.json`
     - `src/chrome/manifest.json`
     - `src/firefox/manifest.json`
     - `src/safari/manifest.json`
  4. `CHANGELOG.md` — add a new section for the bumped version with clear bullet points.
  5. `RELEASE_NOTES.md` — prepend the release summary for the new version.
- **Rebuild distributable artifacts immediately after bumping:**
  Always execute the full build and target Chromium MV3:
  ```bash
  npm run build && npm run build:chromium-mv3 && rsync -a --delete build/all/ build/chromium-mv3-unpacked/
  ```
  Ensure `build/chromium-mv3-unpacked/manifest.json` reflects the new version so
  Chrome users can simply click "Reload" in `chrome://extensions/` and see the new version immediately.
- **Report the new version in the user summary:** State the bumped version explicitly in your final response.

## Browser Extension Build Notes

- Before any build that is meant to produce distributable browser artifacts,
  always bump the extension version first. Do not reuse the same version number
  for a new build.
- When bumping the version, update every version source that ships with the
  extension, including `package.json`, `package-lock.json`, and the browser
  manifests under `src/chrome/`, `src/chrome-mv3/`, `src/firefox/`, and
  `src/safari/`.
- Prefer targeted builds while iterating; run the full build before handing off
  packaging or release work.
- `grunt build` and `npm run build` generate build artifacts under `build/`.
  Treat generated build outputs as disposable unless the user explicitly asks
  for release artifacts.
- **Always finish builds by targeting Chromium MV3:**
  The root `npm run build` (and default `webpack`) runs all 4 browser configs
  sequentially into the shared `build/all/` directory: Firefox -> Chromium MV2 ->
  Chromium MV3 -> Safari. Because Safari runs last, it leaves its Manifest V2
  (`manifest_version: 2`) file in `build/all/manifest.json`. Modern Chromium
  rejects Manifest V2 extensions ("unsupported manifest version"). Therefore,
  always run `npm run build:chromium-mv3` after `npm run build` and sync the
  unpacked directory:
  ```bash
  npm run build && npm run build:chromium-mv3 && rsync -a --delete build/all/ build/chromium-mv3-unpacked/
  ```
  This guarantees both `build/all/` and `build/chromium-mv3-unpacked/` contain
  a valid Manifest V3 build ready to be loaded via Chrome's "Load unpacked".
- Always ensure the build also produces unpacked extension directories for the
  browser targets that support them, not just packaged `.zip` or `.crx`
  artifacts. For development / testing:
  - Chromium MV3 unpacked: `build/chromium-mv3-unpacked/` (or `build/all/` after `build:chromium-mv3`).
  - Firefox unpacked: `build/firefox-unpacked/`.
- Safari conversion uses the `dev:safari:convert` npm script and writes into
  `build-safari-extension/`.
- If a build depends on a browser signing, store, or private key credential,
  do not ask the user to paste secrets into chat.

## Passkey Notes

- Browser passkey support is Chromium MV3-only unless the user explicitly asks
  to extend another browser target.
- Main passkey areas:
  - `src/all/passkey/`
  - `src/chrome-mv3/contentScripts/js/passkey-provider/`
  - `src/chrome-mv3/serviceWorker/service/passkey/`
  - `src/chrome-mv3/offscreens/service/passkey/`
- The passkey provider should not open separate browser windows for unlock or
  confirmation flows. Use the extension/plugin surface already available on the
  page.
- Keep passkey UI text localized across all available locale directories.
- Avoid debug/info logs in passkey runtime paths. Keep error logging only when
  it is useful for actionable failure diagnosis and does not expose secrets.
- Current Passly passkey release context:
  - `RELEASE_NOTES.md` describes Passly `6.0.0` as adding Chromium MV3 PassKey
    support, the provider bridge, WebAuthn proxy flow, offscreen keep-alive
    handling, and vault resource helpers.
  - `src/all/passkey/passkeyProviderConstants.js` defines the shared passkey
    provider protocol constants.

## Mobile First Login / Transfer

- Browser first-login import is expected to receive the encrypted private key
  payload from Android; do not redesign the flow around manually moving the key
  from the phone to the browser.
- Preserve existing legacy browser setup/login paths unless the user explicitly
  asks to remove them.
- On 2026-06-02, browser first-login verification was fixed so the transferred
  key verification omits the existing browser session cookie for first-login
  only. Preserve that behavior when touching first-login code.
- On 2026-06-02, browser first-login hardcoded controller errors in
  `MobileTransferEntrypoint.js` were localized, including Ukrainian messages.

## Branding / Assets

- Passly UI logos in the extension are bundled from `passbolt-styleguide` into
  browser-extension web-accessible resources, not served by the API `/img/logo`
  files.
- On 2026-06-02, `/app/passwords` top-left workspace logo and QuickAccess popup
  logo fixes landed in extension commits `38a69c73` and `002e0bf2`.
- Preserve Passly product naming in user-visible strings and manifests unless
  a compatibility or upstream-license notice explicitly requires Passbolt.

## Editing Rules

- Preserve unrelated user changes. Run `git status --short` before broad edits.
- Do not run destructive git commands unless explicitly requested.
- Prefer project-local patterns and existing helper APIs over new abstractions.
- Prefer structured parsers and serializers for JSON and localization edits;
  avoid ad-hoc string manipulation when the project already has a better path.
- Keep changes scoped to the browser target requested by the user. For Chrome
  MV3 work, avoid modifying Firefox, Safari, or legacy Chrome behavior unless
  the change is explicitly shared.
- For localized UI text, update all available locale directories, not only
  English and Ukrainian.
- Use focused tests for changed behavior and report any test that could not be
  run.

## Styleguide Fork

- The UI package comes from the fork `Svaroh/passly_styleguide`, checked out as
  a sibling directory `passly_styleguide/` on branch `passly/offline` (branched
  from tag `v5.12.1`, the version this extension builds against). Locally it is
  wired with a symlink: `node_modules/passbolt-styleguide -> ../../passly_styleguide`.
  Run `npm install` inside the fork once - webpack resolves its dependencies
  from there, not from this project.
- The published package ships built stylesheets under `build/css`; a git
  checkout does not, and `build/` is ignored there. `grunt pre-dist` therefore
  runs `scripts/build-styleguide-css.js` first, which builds them with
  `grunt css` in the fork when the sources are newer, and does nothing for a
  published package. Without it the extension renders as unstyled HTML.
- `shell:passly_rebrand_styleguide` rewrites logos inside the styleguide
  package, so a symlinked fork ends up with a dirty working tree after a build.
  The rebrand belongs in the fork as a commit; until then, do not commit those
  files by accident.

## Checking That The Vault Works Without A Server

- `node test/offline/verifyOfflineWorkspace.js` drives a real browser with the
  built extension, seeds the storage of a device that synchronised once, and
  checks that the workspace renders its resources twice: with no network at
  all, and with the network up but an account domain that does not resolve.
  It needs `npm i --no-save playwright && npx playwright install chromium`, and
  a build in `build/all` first.
- Reach for it whenever something in the boot path changes. What breaks offline
  use is never the storage - it is the application asking the API for one more
  thing before it renders anything, and only a real browser shows that.
