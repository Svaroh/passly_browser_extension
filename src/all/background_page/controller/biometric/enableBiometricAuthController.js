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

import Keyring from "../../model/keyring";
import CheckPassphraseService from "../../service/crypto/checkPassphraseService";
import BiometricAuthService from "../../service/biometric/biometricAuthService";

class EnableBiometricAuthController {
  /**
   * Constructor.
   * @param {Worker} worker The worker.
   * @param {string} requestId The request identifier.
   * @param {AbstractAccountEntity} account The account.
   */
  constructor(worker, requestId, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.checkPassphraseService = new CheckPassphraseService(new Keyring());
    this.biometricAuthService = new BiometricAuthService(account);
  }

  /**
   * Wrapper of exec function to run it with worker.
   * @param {string} passphrase The passphrase to protect with biometric auth.
   * @returns {Promise<void>}
   */
  async _exec(passphrase) {
    try {
      await this.exec(passphrase);
      this.worker.port.emit(this.requestId, "SUCCESS");
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Enable biometric auth.
   * @param {string} passphrase The passphrase to protect with biometric auth.
   * @returns {Promise<void>}
   */
  async exec(passphrase) {
    await this.checkPassphraseService.checkPassphrase(passphrase);
    await this.biometricAuthService.enable(passphrase);
  }
}

export default EnableBiometricAuthController;
