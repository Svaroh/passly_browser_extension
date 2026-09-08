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

import ServerStatusApiService from "../api/status/serverStatusApiService";

export default class FindServerStatusService {
  /**
   * @constructor
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(apiClientOptions) {
    this.serverStatusApiService = new ServerStatusApiService(apiClientOptions);
  }

  /**
   * Find the server status.
   * If any error is catch return false else return true
   * @returns {Promise<boolean>}
   */
  async find() {
    try {
      await this.serverStatusApiService.find();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
