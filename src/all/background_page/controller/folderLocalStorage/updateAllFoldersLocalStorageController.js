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
 * @since         4.9.4
 */
import FindAndUpdateFoldersLocalStorageService from "../../service/folder/findAndUpdateFoldersLocalStorageService";
import { isExpectedControllerError, safePortEmit } from "../../utils/error/isExpectedControllerError";

class UpdateAllFolderLocalStorageController {
  /**
   * UpdateAllFolderLocalStorageController constructor
   *
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account The account associated to the worker.clientOptions
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.findAndUpdateFoldersLocalStorageService = new FindAndUpdateFoldersLocalStorageService(
      account,
      apiClientOptions,
    );
  }

  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      await this.exec();
      safePortEmit(this.worker, this.requestId, "SUCCESS");
    } catch (error) {
      if (!isExpectedControllerError(error)) {
        console.error(error);
      }
      safePortEmit(this.worker, this.requestId, "ERROR", error);
    }
  }

  /**
   * Update the folder local storage.
   * @returns {Promise<void>}
   */
  async exec() {
    await this.findAndUpdateFoldersLocalStorageService.findAndUpdateAll({ updatePeriodThreshold: 10000 });
  }
}

export default UpdateAllFolderLocalStorageController;
