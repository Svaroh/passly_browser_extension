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
 * @since         5.13.0
 */

import { assertUuid } from "passbolt-styleguide/src/shared/utils/assertions";
import MarkOfflineResourceService from "../../service/offlineResource/markOfflineResourceService";

class MarkResourceOfflineAvailableController {
  /**
   * @constructor
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account The account associated to the worker.
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.markOfflineResourceService = new MarkOfflineResourceService(account, apiClientOptions);
  }

  /**
   * Controller executor.
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
   * Mark a resource available offline.
   * @param {string} resourceId The resource id to mark
   * @returns {Promise<OfflineItemEntity>} The offline item entity
   */
  async exec(resourceId) {
    assertUuid(resourceId);
    return await this.markOfflineResourceService.create(resourceId);
  }
}

export default MarkResourceOfflineAvailableController;
