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
import OfflineSettingsLocalStorage from "../local_storage/offlineSettingsLocalStorage";
import FindOfflineSettingsService from "./findOfflineSettingsService";
import OrganizationSettingsModel from "../../model/organizationSettings/organizationSettingsModel";

const FIND_AND_UPDATE_OFFLINE_SETTINGS_LS_LOCK_PREFIX = "FIND_AND_UPDATE_OFFLINE_SETTINGS_LS_LOCK-";

/**
 * The service aims to find offline settings from the API and store them in the local storage,
 * provided the offline plugin is enabled and the user is allowed to use it.
 */
export default class FindAndUpdateOfflineSettingsLocalStorageService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.account = account;
    this.findOfflineSettingsService = new FindOfflineSettingsService(apiClientOptions);
    this.offlineSettingsLocalStorage = new OfflineSettingsLocalStorage(account);
    this.organisationSettingsModel = new OrganizationSettingsModel(apiClientOptions);
  }

  /**
   * Retrieve the offline settings from the API and store them in the local storage.
   * If the offline plugin is not enabled or the user is not allowed, return null.
   * @returns {Promise<OfflineSettingsEntity|null>}
   */
  async findAndUpdate() {
    const lockKey = `${FIND_AND_UPDATE_OFFLINE_SETTINGS_LS_LOCK_PREFIX}${this.account.id}`;

    // If no update is in progress, refresh the local storage.
    return await navigator.locks.request(lockKey, { ifAvailable: true }, async (lock) => {
      // Lock not granted, an update is already in progress. Wait for its completion and return the value of the local storage.
      if (!lock) {
        return await navigator.locks.request(lockKey, { mode: "shared" }, async () => {
          const offlineSettingsDto = await this.offlineSettingsLocalStorage.get();
          return offlineSettingsDto ? new OfflineSettingsEntity(offlineSettingsDto) : null;
        });
      }

      // Lock is granted. Skip the API call if the offline plugin is not enabled.
      const organizationSettings = await this.organisationSettingsModel.getOrFind();
      if (!organizationSettings.isPluginEnabled("offline")) {
        return null;
      }

      // The API returns no settings when the user is not allowed to use offline mode.
      const offlineSettings = await this.findOfflineSettingsService.get();
      if (!offlineSettings) {
        return null;
      }

      await this.offlineSettingsLocalStorage.set(offlineSettings);
      return offlineSettings;
    });
  }
}
