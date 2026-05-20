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
    const rpId = await this.getRpId(port);
    if (this.usePassboltPageOrigin()) {
      return port.request("passbolt.biometric-auth.is-available-in-page", rpId);
    }
    return BiometricAuthClientService.isAvailable(rpId);
  }

  /**
   * Create a biometric auth configuration.
   * @param {Port} port The extension port.
   * @param {string} passphrase The passphrase to protect.
   * @returns {Promise<object>}
   */
  static async createConfiguration(port, passphrase) {
    const rpId = await this.getRpId(port);
    if (this.usePassboltPageOrigin()) {
      return port.request("passbolt.biometric-auth.create-configuration-in-page", passphrase, rpId);
    }
    return BiometricAuthClientService.createConfiguration(passphrase, rpId);
  }

  /**
   * Unlock a biometric auth configuration.
   * @param {Port} port The extension port.
   * @param {object} configuration The encrypted biometric auth configuration.
   * @returns {Promise<string>}
   */
  static async unlock(port, configuration) {
    const rpId = await this.getRpId(port);
    if (this.usePassboltPageOrigin()) {
      return port.request("passbolt.biometric-auth.unlock-in-page", configuration, rpId);
    }
    return BiometricAuthClientService.unlock(configuration, rpId);
  }

  /**
   * Returns whether an error is an expected browser-level biometric unavailability error.
   * @param {Error|DOMException|object} error The error.
   * @returns {boolean}
   */
  static isUnavailableError(error) {
    return BiometricAuthClientService.isUnavailableError(error);
  }
}

export default BiometricAuthRuntimeService;
