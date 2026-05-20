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

import AuthLoginController from "../auth/authLoginController";
import BiometricAuthService from "../../service/biometric/biometricAuthService";

class LoginWithBiometricAuthController {
  /**
   * Constructor.
   * @param {Worker} worker The worker.
   * @param {string} requestId The request identifier.
   * @param {ApiClientOptions} apiClientOptions The api client options.
   * @param {AbstractAccountEntity} account The account.
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.biometricAuthService = new BiometricAuthService(account);
    this.authLoginController = new AuthLoginController(worker, requestId, apiClientOptions, account);
  }

  /**
   * Wrapper of exec function to run it with worker.
   * @param {boolean} rememberMe Whether to remember the passphrase for the current session.
   * @returns {Promise<void>}
   */
  async _exec(rememberMe = false) {
    try {
      await this.exec(rememberMe);
      this.worker.port.emit(this.requestId, "SUCCESS");
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Sign in using biometric auth.
   * @param {boolean} rememberMe Whether to remember the passphrase for the current session.
   * @returns {Promise<void>}
   */
  async exec(rememberMe = false) {
    if (typeof rememberMe !== "boolean") {
      throw new Error("The rememberMe should be a boolean.");
    }

    const passphrase = await this.biometricAuthService.unlock();
    await this.authLoginController.exec(passphrase, rememberMe);
  }
}

export default LoginWithBiometricAuthController;
