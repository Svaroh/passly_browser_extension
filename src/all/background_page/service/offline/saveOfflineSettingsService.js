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
import OfflineSettingsApiService from "../api/offline/offlineSettingsApiService";
import OfflineSettingsLocalStorage from "../local_storage/offlineSettingsLocalStorage";
import { assertType } from "../../utils/assertions";

class SaveOfflineSettingsService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.offlineSettingsApiService = new OfflineSettingsApiService(apiClientOptions);
    this.offlineSettingsLocalStorage = new OfflineSettingsLocalStorage(account);
  }

  /**
   * Save the offline settings to the API and update the local storage with the latest version.
   * @param {OfflineSettingsEntity} offlineSettings The offline settings entity to save
   * @returns {Promise<OfflineSettingsEntity>} The saved offline settings entity
   */
  async save(offlineSettings) {
    assertType(offlineSettings, OfflineSettingsEntity);
    const result = await this.offlineSettingsApiService.save(offlineSettings);
    const savedOfflineSettings = new OfflineSettingsEntity(result.body);
    await this.offlineSettingsLocalStorage.setData(savedOfflineSettings);
    return savedOfflineSettings;
  }
}

export default SaveOfflineSettingsService;
