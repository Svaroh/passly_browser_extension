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

class FindOfflineSettingsService {
  /**
   * @constructor
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(apiClientOptions) {
    this.offlineSettingsApiService = new OfflineSettingsApiService(apiClientOptions);
  }

  /**
   * Get offline settings
   * @returns {Promise<OfflineSettingsEntity|null>} The offline settings entity or null if not found
   */
  async get() {
    const result = await this.offlineSettingsApiService.find();
    if (Object.keys(result.body).length > 0) {
      return new OfflineSettingsEntity(result.body);
    }
    return null;
  }
}

export default FindOfflineSettingsService;
