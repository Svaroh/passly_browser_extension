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
