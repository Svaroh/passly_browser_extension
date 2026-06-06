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
   * Get the relying party id for the current account domain.
   * @param {Port} port The extension port.
   * @returns {Promise<string|null>}
   */
  static async getRpId(port) {
    if (!this.usePassboltPageOrigin()) {
      if (["http:", "https:"].includes(globalThis.location?.protocol)) {
        return BiometricAuthClientService.normalizeRpId(globalThis.location?.hostname, null);
      }
      return null;
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
      if (this.usePassboltPageOrigin()) {
        return port.request("passbolt.biometric-auth.is-available-in-page", rpId);
      }
      return BiometricAuthClientService.isAvailable(rpId);
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
      if (this.usePassboltPageOrigin()) {
        return port.request("passbolt.biometric-auth.create-configuration-in-page", passphrase, rpId);
      }
      return BiometricAuthClientService.createConfiguration(passphrase, rpId);
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
      if (this.usePassboltPageOrigin()) {
        return port.request("passbolt.biometric-auth.unlock-in-page", configuration, rpId);
      }
      return BiometricAuthClientService.unlock(configuration, rpId);
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

    if (configuration.rp_id !== rpId) {
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
    if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
      return false;
    }

    try {
      const response = await browser.runtime.sendMessage({ name });
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
    if (typeof browser === "undefined" || !browser.storage?.local?.get) {
      return true;
    }

    try {
      const settings = await browser.storage.local.get(PASSKEY_PROVIDER_ENABLED_STORAGE_KEY);
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
