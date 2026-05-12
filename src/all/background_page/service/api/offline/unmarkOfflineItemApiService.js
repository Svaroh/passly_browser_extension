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
import AbstractService from "../abstract/abstractService";
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";
import { assertUuid } from "../../../utils/assertions";
const OFFLINE_API_SERVICE_RESOURCE_NAME = `offline`;

class UnmarkOfflineItemApiService extends AbstractService {
  /**
   * Constructor
   *
   * @param {ApiClientOptions} apiClientOptions
   * @public
   */
  constructor(apiClientOptions) {
    super(apiClientOptions, UnmarkOfflineItemApiService.RESOURCE_NAME);
  }

  /**
   * API Resource Name
   *
   * @returns {string}
   * @public
   */
  static get RESOURCE_NAME() {
    return OFFLINE_API_SERVICE_RESOURCE_NAME;
  }

  /**
   * UnmarkOfflineResource using Passbolt API
   *
   * @param {string} offlineItemId uuid
   * @returns {Promise<PassboltResponseEntity>} Passbolt Response Entity
   * @throw {TypeError} if offline item id is not valid
   * @public
   */
  async delete(offlineItemId) {
    assertUuid(offlineItemId);
    const response = await this.apiClient.delete(offlineItemId);
    return new PassboltResponseEntity(response);
  }
}

export default UnmarkOfflineItemApiService;
