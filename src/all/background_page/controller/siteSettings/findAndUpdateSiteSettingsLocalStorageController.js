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
import FindAndUpdateSiteSettingsLocalStorageService from "../../service/siteSettings/findAndUpdateSiteSettingsLocalStorageService";

/**
 * Retrieve the site settings from the API and update the caches.
 */
class FindAndUpdateSiteSettingsLocalStorageController {
  /**
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions
   * @param {AccountEntity} account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.findAndUpdateSiteSettingsLocalStorageService = new FindAndUpdateSiteSettingsLocalStorageService(
      account,
      apiClientOptions,
    );
  }

  /**
   * Controller executor.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      const siteSettings = await this.exec();
      this.worker.port.emit(this.requestId, "SUCCESS", siteSettings);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Controller executor.
   * @returns {Promise<SiteSettingsEntity>}
   */
  async exec() {
    return await this.findAndUpdateSiteSettingsLocalStorageService.findAndUpdateAll();
  }
}

export default FindAndUpdateSiteSettingsLocalStorageController;
