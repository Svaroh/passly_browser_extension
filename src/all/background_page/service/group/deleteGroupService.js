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

import GroupApiService from "../api/group/groupApiService";
import GroupLocalStorage from "../local_storage/groupLocalStorage";
import GroupDeleteTransferEntity from "../../model/entity/group/transfer/groupDeleteTransferEntity";
import DeleteDryRunError from "../../error/deleteDryRunError";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import { assertType } from "../../utils/assertions";
import { assertUuid } from "passbolt-styleguide/src/shared/utils/assertions";

/**
 * The service aims to delete a group from the API, or check whether it can be deleted.
 */
export default class DeleteGroupService {
  /**
   *
   * @param {ApiClientOptions} apiClientOptions
   * @param {AccountEntity} account
   * @public
   */
  constructor(apiClientOptions, account) {
    this.groupApiService = new GroupApiService(apiClientOptions);
    this.groupLocalStorage = new GroupLocalStorage(account);
  }

  /**
   * Check if a group can be deleted.
   *
   * A group can not be deleted if it is the only owner of a shared resource or folder.
   * In such case ownership transfer is required.
   *
   * @param {string} groupId The group id
   * @returns {Promise<void>}
   * @throws {DeleteDryRunError} if some permissions must be transferred
   * @throws {Error} if the API returns an error other than a 400 with permissions to transfer
   * @public
   */
  async deleteDryRun(groupId) {
    assertUuid(groupId, 'The parameter "groupId" should be a UUID');
    try {
      await this.groupApiService.delete(groupId, {}, true);
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Delete a group and transfer ownership if needed, then remove it from the local storage.
   *
   * @param {string} groupId The group id
   * @param {GroupDeleteTransferEntity} [transfer] optional ownership transfer information if needed
   * @returns {Promise<void>}
   * @throws {DeleteDryRunError} if some permissions must be transferred
   * @throws {Error} if the API returns an error other than a 400 with permissions to transfer
   * @public
   */
  async delete(groupId, transfer) {
    assertUuid(groupId, 'The parameter "groupId" should be a UUID');
    if (transfer) {
      assertType(transfer, GroupDeleteTransferEntity, 'The parameter "transfer" should be a GroupDeleteTransferEntity');
    }
    try {
      const deleteData = transfer ? transfer.toDto() : {};
      await this.groupApiService.delete(groupId, deleteData);
    } catch (error) {
      await this.handleError(error);
    }
    // Update local storage
    await this.groupLocalStorage.delete(groupId);
  }

  /**
   * @private
   * @param {object} error The error
   * @throws {DeleteDryRunError} if some permissions must be transferred
   * @throws {Error} the original error otherwise
   */
  async handleError(error) {
    if (error instanceof PassboltApiFetchError && error.data.code === 400 && error.data.body.errors) {
      // A 400 with errors means ownerships must be transferred before the group can be deleted.
      throw new DeleteDryRunError(error.message, error.data.body.errors);
    }
    throw error;
  }
}
