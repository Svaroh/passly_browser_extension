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
import AbstractLocalStorage from "./abstractLocalStorage";

export const OFFLINE_SETTINGS = "offline_settings";

class OfflineSettingsLocalStorage extends AbstractLocalStorage {
  /**
   * Get the key property
   * @return {string}
   */
  get key() {
    return OFFLINE_SETTINGS;
  }

  /**
   * Get the entity class
   * @return {OfflineSettingsEntity}
   */
  get entityClass() {
    return OfflineSettingsEntity;
  }
}

export default OfflineSettingsLocalStorage;
