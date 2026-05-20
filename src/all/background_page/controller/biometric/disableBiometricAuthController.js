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

import BiometricAuthService from "../../service/biometric/biometricAuthService";

class DisableBiometricAuthController {
  /**
   * Constructor.
   * @param {Worker} worker The worker.
   * @param {string} requestId The request identifier.
   * @param {AbstractAccountEntity} account The account.
   */
  constructor(worker, requestId, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.biometricAuthService = new BiometricAuthService(account);
  }

  /**
   * Wrapper of exec function to run it with worker.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      await this.exec();
      this.worker.port.emit(this.requestId, "SUCCESS");
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Disable biometric auth.
   * @returns {Promise<void>}
   */
  exec() {
    return this.biometricAuthService.disable();
  }
}

export default DisableBiometricAuthController;
