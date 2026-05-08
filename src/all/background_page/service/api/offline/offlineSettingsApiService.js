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
import { assertType } from "../../../utils/assertions";
import AbstractService from "../abstract/abstractService";
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";

const OFFLINE_SETTINGS_RESOURCE_NAME = "offline/settings";

class OfflineSettingsApiService extends AbstractService {
  /**
   * Constructor
   *
   * @param {ApiClientOptions} apiClientOptions
   * @public
   */
  constructor(apiClientOptions) {
    super(apiClientOptions, OfflineSettingsApiService.RESOURCE_NAME);
  }

  /**
   * API Resource Name
   *
   * @returns {string}
   * @public
   */
  static get RESOURCE_NAME() {
    return OFFLINE_SETTINGS_RESOURCE_NAME;
  }

  /**
   * Find offline settings
   *
   * @returns {Promise<*>} response body
   * @throws {Error} if options are invalid or API error
   * @public
   */
  async find() {
    const response = await this.apiClient.findAll();
    return new PassboltResponseEntity(response);
  }

  /**
   * save offline settings
   *
   * @returns {Promise<*>} response body
   * @throws {Error} if options are invalid or API error
   * @public
   */
  async save(offlineSettings) {
    assertType(offlineSettings, OfflineSettingsEntity);

    const response = await this.apiClient.create(offlineSettings);
    return new PassboltResponseEntity(response);
  }

  /**
   * delete offline settings
   *
   * @returns {Promise<*>} response body
   * @throws {Error} if options are invalid or API error
   * @public
   */
  async delete(id) {
    this.assertValidId(id);
    const result = await this.apiClient.delete(id);
    return new PassboltResponseEntity(result);
  }
}

export default OfflineSettingsApiService;
