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

import BiometricAuthClientService from "../../../webAccessibleResources/js/service/biometricAuthClientService";

class BiometricAuthPageService {
  /**
   * Listen to biometric requests that need to run from the Passbolt HTTPS page origin.
   * @param {Port} port The content script port.
   * @returns {void}
   */
  static listen(port) {
    port.on("passbolt.biometric-auth.is-available-in-page", async (requestId, rpId) => {
      await this.respond(port, requestId, () => BiometricAuthClientService.isAvailable(rpId));
    });

    port.on("passbolt.biometric-auth.create-configuration-in-page", async (requestId, passphrase, rpId) => {
      await this.respond(port, requestId, () => BiometricAuthClientService.createConfiguration(passphrase, rpId));
    });

    port.on("passbolt.biometric-auth.unlock-in-page", async (requestId, configuration, rpId) => {
      await this.respond(port, requestId, () => BiometricAuthClientService.unlock(configuration, rpId));
    });
  }

  /**
   * Respond to a background page request.
   * @param {Port} port The content script port.
   * @param {string} requestId The request id.
   * @param {Function} callback The action to execute.
   * @returns {Promise<void>}
   */
  static async respond(port, requestId, callback) {
    try {
      const result = await callback();
      await port.emit(requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      await port.emit(requestId, "ERROR", this.serializeError(error));
    }
  }

  /**
   * Serialize DOMException and Error objects for extension messaging.
   * @param {Error|DOMException} error The error.
   * @returns {{name: string, message: string}}
   */
  static serializeError(error) {
    return {
      name: error?.name || "Error",
      message: error?.message || "Biometric authentication failed.",
    };
  }
}

export default BiometricAuthPageService;
