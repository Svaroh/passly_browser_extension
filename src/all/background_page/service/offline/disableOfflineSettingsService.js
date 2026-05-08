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
import { assertUuid } from "../../utils/assertions";

class DisableOfflineSettingsService {
  /**
   * @constructor
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(apiClientOptions) {
    this.offlineSettingsApiService = new OfflineSettingsApiService(apiClientOptions);
  }

  /**
   * Disable offline settings by id
   * @param {string} id The offline settings uuid
   * @returns {Promise<PassboltResponseEntity>} The api response
   */
  async disable(id) {
    assertUuid(id);
    return this.offlineSettingsApiService.delete(id);
  }
}

export default DisableOfflineSettingsService;
