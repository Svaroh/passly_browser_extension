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
import AccountEntity from "../../model/entity/account/accountEntity";

export const OFFLINE_SETTINGS = "offline_settings";

class OfflineSettingsLocalStorage {
  /**
   * Runtime cached data.
   * @key {Object} Key: account_id, value: cached data as dto.
   * @private
   */
  static _runtimeCachedData = {};

  /**
   * Constructor
   * @param account the user account
   */
  constructor(account) {
    if (!account || !(account instanceof AccountEntity)) {
      throw new TypeError("Parameter `account` should be of key AccountEntity.");
    }
    this.account = account;
    this.storageKey = this.getStorageKey(account);
  }

  /**
   * Get the storage key.
   * @param {AbstractAccountEntity} account The account to get the key for.
   * @returns {string}
   * @throws {Error} If it cannot retrieve account id.
   */
  getStorageKey(account) {
    return `${OFFLINE_SETTINGS}-${account.id}`;
  }

  /**
   * Flush offline settings from local storage and runtime cached data.
   * @return {Promise<void>}
   */
  async flush() {
    await browser.storage.local.remove(this.storageKey);
    delete OfflineSettingsLocalStorage._runtimeCachedData[this.account.id];
    console.debug(`Offline Settings flushed for (${this.account.id})`);
  }

  /**
   * Get the offline settings from the local storage.
   * @return {Promise<object|undefined>}
   */
  async get() {
    if (!OfflineSettingsLocalStorage._runtimeCachedData[this.account.id]) {
      const data = await browser.storage.local.get([this.storageKey]);
      if (!data[this.storageKey]) {
        return;
      }
      OfflineSettingsLocalStorage._runtimeCachedData[this.account.id] = data[this.storageKey];
    }

    return OfflineSettingsLocalStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Set the offline settings in the local storage.
   * @param {OfflineSettingsEntity} settings The settings to insert in the local storage.
   * @return {Promise<void>}
   * @throws {TypeError} If parameter settings is not of key OfflineSettingsEntity.
   */
  async set(settings) {
    if (!settings || !(settings instanceof OfflineSettingsEntity)) {
      throw new TypeError("Parameter `settings` should be of key OfflineSettingsEntity");
    }
    await navigator.locks.request(this.storageKey, async () => {
      const settingsDto = settings.toDto();
      await this._setBrowserStorage({ [this.storageKey]: settingsDto });
      OfflineSettingsLocalStorage._runtimeCachedData[this.account.id] = settingsDto;
    });
  }

  /**
   * Set the browser storage.
   * @param {object} data The data to store in the local storage.
   * @returns {Promise<void>}
   * @private
   */
  async _setBrowserStorage(data) {
    await browser.storage.local.set(data);
  }
}

export default OfflineSettingsLocalStorage;
