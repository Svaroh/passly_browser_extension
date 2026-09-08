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

import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import SaveOfflineSettingsService from "../../service/offline/saveOfflineSettingsService";

class SaveOfflineSettingsController {
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
    this.saveOfflineSettingsService = new SaveOfflineSettingsService(account, apiClientOptions);
  }

  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec(offlineSettingsDto) {
    try {
      const result = await this.exec(offlineSettingsDto);
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Save offline settings.
   * @param {object} offlineSettingsDto The offline settings dto to save
   * @returns {Promise<OfflineSettingsEntity>} The saved offline settings entity
   */
  async exec(offlineSettingsDto) {
    const offlineSettingsEntity = new OfflineSettingsEntity(offlineSettingsDto);
    return await this.saveOfflineSettingsService.save(offlineSettingsEntity);
  }
}

export default SaveOfflineSettingsController;
