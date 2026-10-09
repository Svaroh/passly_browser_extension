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

import GetOrFindOfflineSettingsService from "../../service/offline/getOrFindOfflineSettingsService";

class GetOrFindOfflineSettingsController {
  /**
   * @constructor
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account the user account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.getOrFindOfflineSettingsService = new GetOrFindOfflineSettingsService(account, apiClientOptions);
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
   * Get the offline settings from the local storage, or retrieve them from the API and update the local storage.
   * @returns {Promise<OfflineSettingsEntity|null>} The offline settings entity or null if not found
   */
  async exec() {
    return this.getOrFindOfflineSettingsService.getOrFind();
  }
}

export default GetOrFindOfflineSettingsController;
