/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.12.0
 */
import userModel from "../../model/user/userModel";
import { isExpectedControllerError, safePortEmit } from "../../utils/error/isExpectedControllerError";

class UpdateUserLocalStorageController {
  /**
   * UpdateUserLocalStorageController constructor
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions
   * @param {AccountEntity} account the account associated to the worker
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.userModel = new userModel(apiClientOptions, account);
  }

  /**
   * Wrapper of exec function to run it with worker.
   *
   * @return {Promise<void>}
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
   * Update the user local storage
   *
   * @return {Promise<void>}
   */
  async exec() {
    await this.userModel.updateLocalStorage();
  }
}

export default UpdateUserLocalStorageController;
