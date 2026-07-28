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

import OfflineSettingsApiService from "../api/offline/offlineSettingsApiService";
import OfflineSettingsLocalStorage from "../local_storage/offlineSettingsLocalStorage";
import { assertUuid } from "../../utils/assertions";

class DisableOfflineSettingsService {
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
   * Disable the offline settings by id and clear the local storage.
   * @param {string} id The offline settings uuid
   * @returns {Promise<PassboltResponseEntity>} The api response
   */
  async disable(id) {
    assertUuid(id);
    const result = await this.offlineSettingsApiService.delete(id);
    await this.offlineSettingsLocalStorage.flush();
    return result;
  }
}

export default DisableOfflineSettingsService;
