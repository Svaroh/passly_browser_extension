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
 * @since         4.8.2
 */
import storage from "../../sdk/storage";
import { Config } from "../../model/config";
import GetLegacyAccountService from "./getLegacyAccountService";
import isMissingAccountError from "./isMissingAccountError";

const ACTIVE_ACCOUNT_KEY = "active-account";

class GetActiveAccountService {
  /**
   * Get the active account associated with this extension.
   * @param {Object} options The option to add more data in the account
   * @return {Promise<AccountEntity>}
   * @throw {Error} if no account yet associated with this extension.
   */
  get(options = {}) {
    return navigator.locks.request(ACTIVE_ACCOUNT_KEY, async () => {
      // Check if the storage have some data
      if (Object.keys(storage._data).length === 0) {
        // Fix the initialization of the storage after an update
        await this.initializeLegacyStorage();
      }
      try {
        return await GetLegacyAccountService.get(options);
      } catch (error) {
        if (!isMissingAccountError(error)) {
          throw error;
        }

        await this.initializeLegacyStorage();
        return await GetLegacyAccountService.get(options);
      }
    });
  }

  /**
   * Initialize the legacy storage cache and the config model.
   * @returns {Promise<void>}
   */
  async initializeLegacyStorage() {
    await storage.init();
    // Initialization of the config to get the user information
    Config.init();
  }
}

export default new GetActiveAccountService();
