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
import GetOrFindSiteSettingsService from "../../service/siteSettings/getOrFindSiteSettingsService";

/**
 * Returns the site settings, from the cache that fits the session or by fetching from the API.
 * Resolves to null on an offline session with nothing persisted, the one case that cannot fall
 * back to the API.
 */
class GetOrFindSiteSettingsController {
  /**
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions
   * @param {AccountEntity} account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.account = account;
    this.getOrFindSiteSettingsService = new GetOrFindSiteSettingsService(account, apiClientOptions);
  }

  /**
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      const result = await this.exec.apply(this, arguments);
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * @returns {Promise<SiteSettingsEntity|null>} null on an offline session with nothing persisted.
   */
  async exec() {
    return this.getOrFindSiteSettingsService.getOrFind();
  }
}

export default GetOrFindSiteSettingsController;
