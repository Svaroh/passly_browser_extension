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
 * @since         5.16.0
 */

import DeleteFolderService from "../../service/folder/deleteFolderService";

class DeleteFolderController {
  /**
   * Constructor
   *
   * @param {Worker} worker The associated worker
   * @param {string} requestId The associated request id
   * @param {ApiClientOptions} apiClientOptions The api client options
   * @param {AccountEntity} account The user account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.deleteFolderService = new DeleteFolderService(apiClientOptions, account);
  }
  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      const result = await this.exec.apply(this, arguments);
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }
  /**
   * Delete a folder
   * @param {string} folderId The folder id
   * @param {boolean} [cascade = false] Also delete the folder content
   * @returns {Promise<string>} The deleted folder id
   */
  async exec(folderId, cascade = false) {
    await this.deleteFolderService.delete(folderId, cascade);
    return folderId;
  }
}
export default DeleteFolderController;
