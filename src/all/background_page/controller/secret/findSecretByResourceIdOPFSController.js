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
import FindSecretOPFSService from "../../service/secret/findSecretOPFSService";

class FindSecretByResourceIdOPFSController {
  /**
   * FindSecretByResourceIdOPFSController constructor
   *
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account The account associated to the worker.
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.findSecretOPFSService = new FindSecretOPFSService(account, apiClientOptions, worker);
  }

  /**
   * Wrapper of exec function to run it with worker.
   * @param {string} resourceId The resource uuid
   * @returns {Promise<void>}
   */
  async _exec(resourceId) {
    try {
      const result = await this.exec(resourceId);
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Find the decrypted secret of a resource made available offline.
   * @param {string} resourceId The resource uuid
   * @returns {Promise<PlaintextEntity>}
   */
  async exec(resourceId) {
    return await this.findSecretOPFSService.findByResourceId(resourceId);
  }
}

export default FindSecretByResourceIdOPFSController;
