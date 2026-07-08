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

import { assertUuid } from "../../utils/assertions";
import UnmarkOfflineItemApiService from "../api/offline/unmarkOfflineItemApiService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import ResourceEntity from "../../model/entity/resource/resourceEntity";

class UnmarkOfflineItemService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account.
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.unmarkOfflineItemApiService = new UnmarkOfflineItemApiService(apiClientOptions);
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
  }

  /**
   * Unmark an offline item available offline and drop its OPFS entries.
   * @param {string} offlineItemId The offline item id (offline_items row id) to delete on the API.
   * @returns {Promise<null>} A null response
   */
  async delete(offlineItemId) {
    assertUuid(offlineItemId);
    const result = await this.unmarkOfflineItemApiService.delete(offlineItemId);
    const resourceDto = await ResourceLocalStorage.getResourceByOfflineItemId(offlineItemId);
    if (resourceDto) {
      const resourceEntity = new ResourceEntity(resourceDto);
      const resourceId = resourceEntity.id;
      // Clear the offline item from the resource and update it in the local storage.
      resourceEntity.offline = null;
      await ResourceLocalStorage.updateResource(resourceEntity);
      await this.offlineResourcesOPFSStorage.delete(resourceId);
      await this.offlineSecretsOPFSStorage.deleteByResourceId(resourceId);
    }
    return result.body;
  }
}

export default UnmarkOfflineItemService;
