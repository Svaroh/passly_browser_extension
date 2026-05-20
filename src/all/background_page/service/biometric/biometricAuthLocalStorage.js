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
 */

const BIOMETRIC_AUTH_LOCAL_STORAGE_KEY = "biometricAuth";

class BiometricAuthLocalStorage {
  /**
   * Constructor
   * @param {AbstractAccountEntity} account the user account
   */
  constructor(account) {
    this.storageKey = this.getStorageKey(account);
  }

  /**
   * Get the storage key.
   * @param {AbstractAccountEntity} account The account to get the key for.
   * @returns {string}
   */
  getStorageKey(account) {
    if (!account?.id) {
      throw new Error("Cannot retrieve account id, necessary to get a biometric auth storage key.");
    }
    return `${BIOMETRIC_AUTH_LOCAL_STORAGE_KEY}-${account.id}`;
  }

  /**
   * Get the stored biometric auth data.
   * @returns {Promise<object|null>}
   */
  async get() {
    const value = await browser.storage.local.get([this.storageKey]);
    return value?.[this.storageKey] || null;
  }

  /**
   * Store the biometric auth data.
   * @param {object} data The biometric auth data.
   * @returns {Promise<void>}
   */
  async set(data) {
    await navigator.locks.request(this.storageKey, async () => {
      await browser.storage.local.set({ [this.storageKey]: data });
    });
  }

  /**
   * Flush the stored biometric auth data.
   * @returns {Promise<void>}
   */
  async flush() {
    await browser.storage.local.remove(this.storageKey);
  }
}

export default BiometricAuthLocalStorage;
