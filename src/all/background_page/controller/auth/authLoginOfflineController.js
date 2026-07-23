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
 * @since         6.0.0
 */
import Keyring from "../../model/keyring";
import CheckPassphraseService from "../../service/crypto/checkPassphraseService";
import PostLoginOfflineService from "../../service/auth/postLoginOfflineService";
import { assertNumber } from "passbolt-styleguide/src/shared/utils/assertions";
import { assertPassphrase } from "../../utils/assertions";

/**
 * Mirror of AuthLoginController stripped to the offline path: local passphrase check only, no server
 * challenge verification, no SSO, no keep-session-alive.
 */
class AuthLoginOfflineController {
  /**
   * AuthLoginOfflineController constructor
   * @param {Worker} worker
   * @param {string} requestId uuid
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account The user account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.apiClientOptions = apiClientOptions;
    this.account = account;
    this.checkPassphraseService = new CheckPassphraseService(new Keyring());
  }

  /**
   * Wrapper of exec function to run it with worker.
   * @param {string} passphrase The passphrase to decrypt the private key
   * @param {number} sessionDuration the chosen session duration duration in seconds
   * @return {Promise<void>}
   */
  async _exec(passphrase, sessionDuration) {
    try {
      await this.exec(passphrase, sessionDuration);
      this.worker.port.emit(this.requestId, "SUCCESS");
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Attempts to sign in the current user in offline mode.
   * @param {string} passphrase The passphrase to decrypt the private key
   * @param {number} sessionDuration the chosen session duration duration in seconds
   * @return {Promise<void>}
   */
  async exec(passphrase, sessionDuration) {
    assertPassphrase(passphrase);
    assertNumber(sessionDuration, "The session duration should be a number.");
    await this.checkPassphraseService.checkPassphrase(passphrase);
    await new PostLoginOfflineService(this.account, this.apiClientOptions).exec(passphrase, sessionDuration);
  }
}

export default AuthLoginOfflineController;
