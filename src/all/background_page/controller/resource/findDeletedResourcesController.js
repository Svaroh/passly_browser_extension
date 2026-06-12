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
 * @since         6.0.3
 */

import FindAndUpdateResourcesLocalStorage from "../../service/resource/findAndUpdateResourcesLocalStorageService";
import GetPassphraseService from "../../service/passphrase/getPassphraseService";
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import ResourceLocalStorage from "../../service/local_storage/resourceLocalStorage";

class FindDeletedResourcesController {
  /**
   * Constructor.
   * @param {Worker} worker The associated worker.
   * @param {string} requestId The associated request id.
   * @param {ApiClientOptions} apiClientOptions The api client options.
   * @param {AccountEntity} account The account associated to the worker.
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.findAndUpdateResourcesLocalStorage = new FindAndUpdateResourcesLocalStorage(account, apiClientOptions);
    this.getPassphraseService = new GetPassphraseService(account);
  }

  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      const result = await this.exec();
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Retrieve recoverably deleted resources and update local storage.
   * @returns {Promise<Array<object>>}
   */
  async exec() {
    try {
      return this.toLocalStorageDtos(await this.findAndUpdateResourcesLocalStorage.findAndUpdateDeleted());
    } catch (error) {
      if (!(error instanceof UserPassphraseRequiredError)) {
        throw error;
      }
      const passphrase = await this.getPassphraseService.getPassphrase(this.worker, 60);
      return this.toLocalStorageDtos(await this.findAndUpdateResourcesLocalStorage.findAndUpdateDeleted(passphrase));
    }
  }

  /**
   * Format resources with the same contain used by the resources local storage.
   * @param {ResourcesCollection} resourcesCollection The resources collection.
   * @returns {Array<object>}
   */
  toLocalStorageDtos(resourcesCollection) {
    return resourcesCollection.items.map((resource) => resource.toDto(ResourceLocalStorage.DEFAULT_CONTAIN));
  }
}

export default FindDeletedResourcesController;
