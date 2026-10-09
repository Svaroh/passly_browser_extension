/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SARL (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SARL (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.2.0
 */
import GetOrFindSiteSettingsController from "../controller/siteSettings/getOrFindSiteSettingsController";
import FindAndUpdateSiteSettingsLocalStorageController from "../controller/siteSettings/findAndUpdateSiteSettingsLocalStorageController";

const listen = function (worker, apiClientOptions, account) {
  /*
   * Return the cached site settings, or retrieve them from the API and update the local storage.
   * Resolves to null on an offline session with nothing persisted, the one case that cannot fall
   * back to the API.
   * @listens passbolt.site-settings.get-or-find
   * @param {string} requestId
   */
  worker.port.on("passbolt.site-settings.get-or-find", async (requestId) => {
    const controller = new GetOrFindSiteSettingsController(worker, requestId, apiClientOptions, account);
    await controller._exec();
  });

  /*
   * Retrieve the site settings from the API and update the caches, bypassing them on the way in.
   * For the callers that need the settings to be current as of right now.
   * @listens passbolt.site-settings.find-and-update
   * @param {string} requestId
   */
  worker.port.on("passbolt.site-settings.find-and-update", async (requestId) => {
    const controller = new FindAndUpdateSiteSettingsLocalStorageController(
      worker,
      requestId,
      apiClientOptions,
      account,
    );
    await controller._exec();
  });
};
export const SiteSettingsEvents = { listen };
