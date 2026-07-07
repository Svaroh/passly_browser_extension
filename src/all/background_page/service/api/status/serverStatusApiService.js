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
 * @since         6.0.0
 */
import AbstractService from "passbolt-styleguide/src/shared/services/api/abstract/abstractService";
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";

const SERVER_STATUS_RESOURCE_NAME = "healthcheck/status";

class ServerStatusApiService extends AbstractService {
  /**
   * Constructor
   *
   * @param {ApiClientOptions} apiClientOptions
   * @public
   */
  constructor(apiClientOptions) {
    super(apiClientOptions, ServerStatusApiService.RESOURCE_NAME);
  }

  /**
   * API Resource Name
   *
   * @returns {string}
   * @public
   */
  static get RESOURCE_NAME() {
    return SERVER_STATUS_RESOURCE_NAME;
  }

  /**
   * Find server status
   *
   * @returns {Promise<*>} response body
   * @throws {Error} if options are invalid or API error
   * @public
   */
  async find() {
    const response = await this.apiClient.findAll();
    return new PassboltResponseEntity(response);
  }
}

export default ServerStatusApiService;
