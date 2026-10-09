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
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import FindAndUpdateResourcesLocalStorageFromOPFSService from "../../service/resource/findAndUpdateResourcesLocalStorageFromOPFSService";
import GetPassphraseService from "../../service/passphrase/getPassphraseService";

class FindAndUpdateResourcesLocalStorageFromOPFSController {
  /**
   * FindAndUpdateResourcesLocalStorageFromOPFSController constructor
   *
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account The account associated to the worker.clientOptions
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.findAndUpdateResourcesLocalStorageFromOPFSService = new FindAndUpdateResourcesLocalStorageFromOPFSService(
      account,
      apiClientOptions,
    );
    this.getPassphraseService = new GetPassphraseService(account);
  }

  /**
   * Controller executor.
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
   * Update the resource local storage.
   *
   **/
  async exec() {
    try {
      /**
       * Try to fetch the resources.
       * If the user passphrase is required but not in sessionStorage, prompt the user. The passphrase is needed when:
       * 1. the metadata is encrypted with the shared metadata key, but this one is not yet decrypted in the session storage;
       * 2. the metadata is encrypted with the user private key.
       */
      await this.findAndUpdateResourcesLocalStorageFromOPFSService.findAndUpdateAll();
    } catch (error) {
      if (!(error instanceof UserPassphraseRequiredError)) {
        throw error;
      }
      const passphrase = await this.getPassphraseService.getPassphrase(this.worker);
      await this.findAndUpdateResourcesLocalStorageFromOPFSService.findAndUpdateAll(passphrase);
    }
  }
}

export default FindAndUpdateResourcesLocalStorageFromOPFSController;
