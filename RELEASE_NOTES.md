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
