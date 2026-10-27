# v6.1.13
Passly 6.1.13 resolves unused variables in offline exception catch blocks and adheres to strict linting rules.

### Fixed
- Fixed unused variable warnings in exception handlers across `FindSecretByResourceIdController`, `FindAndUpdateRbacsLocalStorageService`, `GetOrFindRbacService`, and `GetOrFindMeService`.
- Cleaned up lint rules to ensure zero warnings under `--max-warnings 0`.

# v6.1.12
Passly 6.1.12 fixes broken and reverted styling after offline reload, ensuring theme integrity (preventing unintended revert to white) and introduces a dedicated E2E style verification test.

### Fixed
- Prevented user settings and dark theme from resetting to default white on offline server sync failures in `AppInitController` and `UserSettings`.
- Ensured robust absolute extension URL generation in `stylesheet.js` so theme CSS files load reliably in all offline contexts.
- Eliminated whitespace gap in table view by expanding table width to 100% minimum container width.

### Added
- Dedicated E2E style and theme test suite (`npm run test:e2e:style`) testing CSS loading, OS dark mode emulation, computed style palette, and offline theme persistence on real Chrome via CDP.

# v6.1.11
Passly 6.1.11 resolves the issue where the vault turned white after loading or refreshing offline, ensuring seamless offline continuity on the trusted web domain.

### Fixed
- Fixed blank screen after offline load by keeping user authentication and RBAC context resilient against network failures.
- Ensured `AppBootstrapPagemod` correctly attaches to the web vault when offline with a local replica, eliminating unwanted redirects to `/auth/login`.
- Added resilient offline fallbacks in `GetOrFindRbacService` and `FindAndUpdateRbacLocalStorageService`.
- Protected local storage data from being cleared by background session check alarms during offline operation.

# v6.1.10
Passly 6.1.10 incorporates full E2E test coverage across all core vault operations (GPGAuth, secret decryption, password generator, clipboard management, offline replica resilience) and adds BrowserStack Automate cloud integration for cross-platform cloud testing.

### Fixed
- Added seamless offline OPFS and local storage fallback in `AutofillController` to prevent `PassboltServiceUnavailableError` when filling credentials without active network connection.
- Strengthened offline fallback across `FindSecretByResourceIdController`, `FindResourcesService`, and user session services.

### Added
- Comprehensive automated E2E test suite (`npm run test:e2e`) verifying DEV backend authentication, secret decryption, clipboard copy & flush, and offline resilience on real Chrome CDP.
- BrowserStack Automate cloud verification suite (`npm run test:e2e:browserstack`) verifying remote DEV backend connectivity and healthcheck.

# v6.1.9
Passly 6.1.9 incorporates automated E2E verification of Service Worker offline resilience, eliminating `ERR_INTERNET_DISCONNECTED` under real Google Chrome headless execution.

### Added
- Added `test:e2e:offline` script validating real Chrome Service Worker registration, Cache Storage population, and offline navigation under `Network.emulateNetworkConditions({ offline: true })`.

# v6.1.8
Passly 6.1.8 enables native offline PWA operation via Service Worker on the trusted website domain without redirecting user tabs to extension URLs (`chrome-extension://.../workspace.html`).

### Fixed
- Native offline website operation: eliminated intrusive automatic tab redirects to extension-hosted workspace URLs, allowing the website's Service Worker to serve the App Shell from local cache.
- Enable `AppBootstrapPagemod` to attach to the web vault on the trusted domain during offline sessions.
- Seamlessly transition unauthenticated offline navigations on the web vault to `/auth/login` on the same domain, allowing users to unlock via Touch ID / biometrics.
- Keep `OpenTrustedDomainTabService` opening the canonical domain rather than redirecting away to local extension files.

# v6.1.7
Passly 6.1.7 delivers an autonomous extension-hosted offline workspace and seamless offline routing. When accessing the Passly domain while offline, during network outages, or with broken DNS, the browser avoids the browser network error page and immediately opens the full-featured offline workspace.

### Fixed
- Autonomous extension-hosted workspace (`workspace.html`) and local sign-in (`signin.html`) allowing complete vault management, search, folder browsing, and credential copying offline.
- Added `VaultNavigationFallbackService` to intercept offline navigation failures (`ERR_INTERNET_DISCONNECTED`, DNS errors, network down) on the trusted domain, routing seamlessly to the offline workspace.
- Registered `workspace` and `signin` communication ports in `PortManager` to connect `App` and `Auth` pagemods without requiring remote server content scripts.
- Added boot diagnostics and visual offline indicator badge (`Offline - showing the data held on this device`).
- Ensured local sign-in automatically routes to the offline workspace upon successful biometric or passphrase unlock.

# v6.1.6
Passly 6.1.6 resolves the "worker id should be a valid uuid" runtime error for QuickAccess connections and restores direct website navigation without intrusive redirects.

### Fixed
- Fix TypeError: "The worker id should be a valid uuid" by recognizing QuickAccess port connections from tabs and detached windows in PortManager.
- Remove navigation error redirects to quickaccess.html so the website domain loads and operates offline autonomously.
- Restore direct trusted domain navigation in OpenTrustedDomainTabService.

# v6.1.4
Passly 6.1.4 enables direct Touch ID and fingerprint biometric unlock within Chrome extension popups without opening remote server tabs, and adds resilient offline vault login during server, network, or DNS outages.

### Fixed
- Enable native Touch ID / fingerprint biometric unlock directly inside Chrome extension popups and panels without opening external server tabs or closing the extension.
- Add seamless offline session fallback in AuthLoginController when unlocking with biometrics or passphrase during server, network, or DNS unavailability.
- Remove server connectivity blocks and manual passphrase prompts when fingerprint unlock is available.
- Provide fallback WebAuthn credential retrieval in extension contexts when relying party domain restrictions apply.

# v6.1.3
Passly 6.1.3 fixes QuickAccess vault navigation and resource deletion actions.

### Fixed
- Fix QuickAccess "View in the vault" and "Edit in the vault" buttons by adding `passbolt.tabs.open-vault-page` background handler and navigation controller.
- Fix QuickAccess "Delete" button by integrating scoped dialog styling for popup view and ensuring reliable resource ID resolution.

# v6.1.2
Passly 6.1.2 fixes Passkey interception by ensuring confirmation dialogs display by default, deferring vault unlocking, and supporting Oracle SSO multi-domain matching.

### Fixed
- Passkey confirmation dialog displays by default for WebAuthn get and create requests without silent background skips.
- Vault unlocking is deferred until after the user confirms passkey usage.
- Support Oracle SSO multi-domain ecosystem (oracle.com and oraclecloud.com) and resource URIs during passkey assertion matching.
- Reset passkey provider suspend count on user confirmation and add safety auto-resume timeout.
- Remove platform authenticator attachment early bypass on passkey creation.

# v6.1.1
Passly 6.1.1 fixes a QuickAccess password generator crash when generator settings are uninitialized.

### Fixed
- Fix TypeError: Cannot read properties of null (reading 'default_generator') when loading QuickAccess popup.
- Add fallback default generator settings and null safety to secret generator and password generator page.

# v6.1.0
Passly 6.1.0 introduces seamless offline mode, non-blocking QuickAccess rendering, biometric unlock for the master passphrase prompt, offline-first PassKey operations, and KDBX PassKey import/export.

### Added
- Seamless offline mode: fallback to local vault and offline login seamlessly when the server is unreachable without interruption.
- Non-blocking QuickAccess: popup renders immediately from cached storage without waiting for background session sync.
- Biometric unlock: biometric authentication support in the passphrase prompt dialog.
- PassKey offline-first support: perform passkey assertions and operations offline with local credentials and zero API latency.
- PassKey import and export in KDBX (KeePass) databases.
- Fallback to native WebAuthn when no matching passkey is found or creation options are unsupported.
- Cross-platform biometric security keys support and origin delegation.
- Byte-level credential ID matching with hex and TypedArray descriptor fallbacks.
- Trash restore and permanent deletion actions in workspace context.
- Ukrainian localization (`uk-UA`) for offline interface, connection status, and login states.

### Changed
- Update extension version to 6.1.0 across all browser targets and package manifests.
- Modernize build tooling and dependencies to upstream v5.16.1.
- Retain cached resources across browser restarts in local storage and OPFS.
- Eliminate background API delays for passkey operations by filtering candidates by Relying Party domain before decryption.

### Fixed
- Fix trash filter routing and search operations in workspace view.
- Fix resource editing action when invoked from URL query parameters.
- Fix OPFS encrypted resource snapshotting and suppress spurious background passphrase prompts.
- Fix quickaccess initialization crashes and race conditions.
- Fix passkey signature DER format conversions.

# v6.0.0
Passly 6.0.0 introduces PassKey support and ships the current Passly-branded browser extension builds.

### Added
- Add PassKey support for Chromium MV3, including the provider bridge, WebAuthn proxy flow, offscreen keep-alive handling, and vault resource helpers.
- Add QuickAccess vault editing and standalone password generator improvements.

### Changed
- Rebrand the browser extension UI, icons, logos, and build artifacts to Passly.
- Update the extension version to 6.0.0 across package metadata and all browser manifests.

### Fixed
- Improve browser first-login import behavior when an existing server session is present.
- Translate browser first-login import errors in the mobile transfer entrypoint.
- Apply dependency and CI maintenance updates, including security-related dependency bumps.

# v5.16.1
Passbolt 5.16.1 fixes an issue on Safari where copy and paste could stop working due to conflicts with other extensions.

## Changelogs
### Fixed
- PB-53792 - Copy/pasting issues on Safari
