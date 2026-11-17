/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 */

import BiometricAuthClientService from "./biometricAuthClientService";
import {
  PASSKEY_PROVIDER_ENABLED_STORAGE_KEY,
  PASSKEY_PROVIDER_MESSAGES,
} from "../../../passkey/passkeyProviderConstants";

class BiometricAuthRuntimeService {
  /**
   * Returns whether WebAuthn needs to be delegated to the Passbolt HTTPS page.
   * @returns {boolean}
   */
  static usePassboltPageOrigin() {
    return globalThis.location?.protocol === "moz-extension:";
  }

  /**
   * Returns whether this extension document is running inside a cross-origin iframe
   * embedded in a Passbolt HTTPS page (e.g. passbolt-iframe-login.html).
   * In Chromium, cross-origin iframes without a publickey-credentials-create Permissions Policy
   * cannot invoke WebAuthn directly and must delegate to the parent HTTPS page.
   * @returns {boolean}
   */
  static isEmbeddedExtensionFrame() {
    if (!["chrome-extension:", "moz-extension:", "safari-web-extension:"].includes(globalThis.location?.protocol)) {
      return false;
    }
    try {
      return (
        typeof globalThis.self !== "undefined" &&
        typeof globalThis.top !== "undefined" &&
        globalThis.self !== globalThis.top
      );
    } catch {
      return true;
    }
  }

  /**
   * Get the relying party id for the current account domain.
   * @param {Port} port The extension port.
   * @returns {Promise<string|null>}
   */
  static async getRpId(port) {
    if (["http:", "https:"].includes(globalThis.location?.protocol)) {
      return BiometricAuthClientService.normalizeRpId(globalThis.location?.hostname, null);
    }

    try {
      return BiometricAuthClientService.normalizeRpId(await port.request("passbolt.addon.get-domain"));
    } catch {
      return BiometricAuthClientService.normalizeRpId();
    }
  }

  /**
   * Returns whether biometric auth is available.
   * @param {Port} port The extension port.
   * @returns {Promise<boolean>}
   */
  static async isAvailable(port) {
    return this.withPasskeyProviderSuspended(async () => {
      const rpId = await this.getRpId(port);
      if (this.usePassboltPageOrigin() || this.isEmbeddedExtensionFrame()) {
        try {
          if (await port.request("passbolt.biometric-auth.is-available-in-page", rpId)) {
            return true;
          }
        } catch {
          // Fall back to direct check below.
        }
      }
      if (await BiometricAuthClientService.isAvailable(rpId).catch(() => false)) {
        return true;
      }
      return false;
    });
  }

  /**
   * Create a biometric auth configuration.
   * @param {Port} port The extension port.
   * @param {string} passphrase The passphrase to protect.
   * @returns {Promise<object>}
   */
  static async createConfiguration(port, passphrase) {
    return this.withPasskeyProviderSuspended(async () => {
      const rpId = await this.getRpId(port);
      if (this.usePassboltPageOrigin() || this.isEmbeddedExtensionFrame()) {
        try {
          return await port.request("passbolt.biometric-auth.create-configuration-in-page", passphrase, rpId);
        } catch (relayError) {
          if (this.usePassboltPageOrigin()) {
            throw relayError;
          }
          return BiometricAuthClientService.createConfiguration(passphrase, rpId);
        }
      }
      try {
        return await BiometricAuthClientService.createConfiguration(passphrase, rpId);
      } catch (error) {
        if (this.isUnavailableError(error)) {
          try {
            return await port.request("passbolt.biometric-auth.create-configuration-in-page", passphrase, rpId);
          } catch {
            throw error;
          }
        }
        throw error;
      }
    });
  }

  /**
   * Unlock a biometric auth configuration.
   * @param {Port} port The extension port.
   * @param {object} configuration The encrypted biometric auth configuration.
   * @returns {Promise<string>}
   */
  static async unlock(port, configuration) {
    return this.withPasskeyProviderSuspended(async () => {
      const rpId = await this.getRpId(port);
      if (this.usePassboltPageOrigin() || this.isEmbeddedExtensionFrame()) {
        try {
          return await port.request("passbolt.biometric-auth.unlock-in-page", configuration, rpId);
        } catch {
          return BiometricAuthClientService.unlock(configuration, rpId);
        }
      }
      try {
        return await BiometricAuthClientService.unlock(configuration, rpId);
      } catch (error) {
        if (this.isUnavailableError(error)) {
          try {
            return await port.request("passbolt.biometric-auth.unlock-in-page", configuration, rpId);
          } catch {
            throw error;
          }
        }
        throw error;
      }
    });
  }

  /**
   * Return only PassKey configurations that were created for the current Passbolt HTTPS origin.
   * Older Chrome extension-origin configurations cannot be used from the Passbolt page origin.
   * @param {Port} port The extension port.
   * @param {object|null} configuration The stored encrypted biometric auth configuration.
   * @returns {Promise<object|null>}
   */
  static async getCompatibleConfiguration(port, configuration) {
    if (!configuration) {
      return null;
    }

    const rpId = await this.getRpId(port);
    if (rpId === null) {
      return configuration.rp_id ? null : configuration;
    }

    if (["http:", "https:"].includes(globalThis.location?.protocol) && !configuration.rp_id) {
      return null;
    }

    if (configuration.rp_id && configuration.rp_id !== rpId) {
      return null;
    }

    return configuration;
  }

  /**
   * Returns whether an error is an expected browser-level biometric unavailability error.
   * @param {Error|DOMException|object} error The error.
   * @returns {boolean}
   */
  static isUnavailableError(error) {
    return BiometricAuthClientService.isUnavailableError(error);
  }

  /**
   * Run a callback while the MV3 passkey proxy is detached.
   * Passly's local biometric auth uses WebAuthn internally and must not be
   * captured by the vault passkey provider.
   * @param {Function} callback The WebAuthn callback to execute.
   * @returns {Promise<*>}
   */
  static async withPasskeyProviderSuspended(callback) {
    const suspensionMode = await this.suspendPasskeyProvider();
    try {
      return await callback();
    } finally {
      if (suspensionMode === "runtime") {
        await this.sendPasskeyProviderMessage(PASSKEY_PROVIDER_MESSAGES.RESUME);
      } else if (suspensionMode === "direct") {
        const didResumeViaRuntime = await this.sendPasskeyProviderMessage(PASSKEY_PROVIDER_MESSAGES.RESUME);
        if (!didResumeViaRuntime) {
          await this.attachPasskeyProviderDirectlyIfEnabled();
        }
      } else {
        await this.sendPasskeyProviderMessage(PASSKEY_PROVIDER_MESSAGES.RESUME);
      }
    }
  }

  /**
   * Suspend the MV3 passkey provider before running an internal biometric WebAuthn request.
   * @returns {Promise<"runtime"|"direct"|null>} The suspension mode used.
   */
  static async suspendPasskeyProvider() {
    if (await this.sendPasskeyProviderMessage(PASSKEY_PROVIDER_MESSAGES.SUSPEND)) {
      return "runtime";
    }

    if (await this.callWebAuthenticationProxyDirectly("detach")) {
      return "direct";
    }

    return null;
  }

  /**
   * Send a best-effort internal message to the MV3 service worker.
   * @param {string} name The message name.
   * @returns {Promise<boolean>} true when the service worker acknowledged it.
   */
  static async sendPasskeyProviderMessage(name) {
    const runtime = (typeof browser !== "undefined" && browser?.runtime) || globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      return false;
    }

    try {
      const response = await runtime.sendMessage({ name });
      return response?.ok === true && response?.result !== false;
    } catch {
      return false;
    }
  }

  /**
   * Re-attach the MV3 passkey provider after a direct fallback detach.
   * @returns {Promise<boolean>}
   */
  static async attachPasskeyProviderDirectlyIfEnabled() {
    if (!(await this.isPasskeyProviderEnabled())) {
      return false;
    }

    return this.callWebAuthenticationProxyDirectly("attach");
  }

  /**
   * Returns whether the hidden MV3 passkey provider switch is enabled.
   * @returns {Promise<boolean>}
   */
  static async isPasskeyProviderEnabled() {
    const storage = (typeof browser !== "undefined" && browser?.storage) || globalThis.chrome?.storage;
    if (!storage?.local?.get) {
      return true;
    }

    try {
      const settings = await storage.local.get(PASSKEY_PROVIDER_ENABLED_STORAGE_KEY);
      return settings[PASSKEY_PROVIDER_ENABLED_STORAGE_KEY] ?? true;
    } catch {
      return true;
    }
  }

  /**
   * Direct extension-page fallback for browsers exposing chrome.webAuthenticationProxy.
   * @param {"attach"|"detach"} action The proxy action.
   * @returns {Promise<boolean>}
   */
  static async callWebAuthenticationProxyDirectly(action) {
    const webAuthenticationProxy = globalThis.chrome?.webAuthenticationProxy;
    if (typeof webAuthenticationProxy?.[action] !== "function") {
      return false;
    }

    try {
      await webAuthenticationProxy[action]();
      return true;
    } catch {
      return false;
    }
  }
}

export default BiometricAuthRuntimeService;
