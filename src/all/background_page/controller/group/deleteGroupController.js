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

import DeleteGroupService from "../../service/group/deleteGroupService";
import GroupDeleteTransferEntity from "../../model/entity/group/transfer/groupDeleteTransferEntity";

export default class DeleteGroupController {
  /**
   * @constructor
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account the account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.deleteGroupService = new DeleteGroupService(apiClientOptions, account);
  }

  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      await this.exec.apply(this, arguments);
      this.worker.port.emit(this.requestId, "SUCCESS");
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Delete a group and transfer ownership if needed.
   * @param {string} groupId The group id
   * @param {object} [transferDto] optional ownership transfer dto, example: {owners: [{aco_foreign_key: <UUID>, id: <UUID>}]}
   * @returns {Promise<void>}
   */
  async exec(groupId, transferDto) {
    const transfer = transferDto ? new GroupDeleteTransferEntity(transferDto) : null;
    await this.deleteGroupService.delete(groupId, transfer);
  }
}
