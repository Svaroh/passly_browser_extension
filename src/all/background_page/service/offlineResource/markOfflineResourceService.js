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
import MarkOfflineResourceApiService from "../api/offlineResource/markOfflineResourceApiService";
import OfflineItemEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import FindResourcesService from "../resource/findResourcesService";
import MetadataKeyOPFSStorage from "../opfsStorage/metadataKeyOPFSStorage";
import FindMetadataKeysService from "../metadata/findMetadataKeysService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import ResourceEntity, { METADATA_KEY_TYPE_METADATA_KEY } from "../../model/entity/resource/resourceEntity";

class MarkOfflineResourceService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account.
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.markOfflineResourceApiService = new MarkOfflineResourceApiService(apiClientOptions);
    this.findResourcesService = new FindResourcesService(account, apiClientOptions);
    this.metadataKeyOPFSStorage = new MetadataKeyOPFSStorage(account);
    this.findMetadataKeysService = new FindMetadataKeysService(apiClientOptions);
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
  }

  /**
   * Mark a resource available offline and seed its OPFS entries.
   * @param {string} resourceId The Resource id
   * @returns {Promise<OfflineItemEntity>} The offline item entity
   */
  async create(resourceId) {
    assertUuid(resourceId);
    const result = await this.markOfflineResourceApiService.create(resourceId);
    const offlineItem = new OfflineItemEntity(result.body);
    await this._updateResourceLocalStorage(resourceId, offlineItem);
    await this._updateOfflineOPFSStorage(resourceId, offlineItem);
    return offlineItem;
  }

  /**
   * Get the resource from local storage
   * Add offline item
   * Update the resource in the local storage
   * @param resourceId
   * @param offlineItem
   * @private
   */
  async _updateResourceLocalStorage(resourceId, offlineItem) {
    const resourceDto = await ResourceLocalStorage.getResourceById(resourceId);
    const resourceEntity = new ResourceEntity(resourceDto);
    resourceEntity.offline = offlineItem;
    await ResourceLocalStorage.updateResource(resourceEntity);
  }

  /**
   * Update the offline OPFS storage
   *
   * Get the resource encrypted with secret from the API
   * Find and set the metadata key OPFS storage if resource used it and metadata key OPFS storage is empty
   * Add resource to the offline resource OPFS storage
   * Add secret to the offline secret OPFS storage
   * @param resourceId
   * @private
   */
  async _updateOfflineOPFSStorage(resourceId) {
    // Warning: Retrieve the resource up to date from the API could have a delta with the one in the local storage
    const resourceEntity = await this.findResourcesService.findOneByIdForOffline(resourceId);
    if (resourceEntity.metadataKeyType === METADATA_KEY_TYPE_METADATA_KEY) {
      const metadataKey = await this.metadataKeyOPFSStorage.get();
      if (!metadataKey) {
        // Retrieve the metadata keys and update the metadata key OPFS storage.
        const metadataKeys = await this.findMetadataKeysService.findAllForSessionStorage();
        await this.metadataKeyOPFSStorage.set(metadataKeys);
      }
    }
    await this.offlineResourcesOPFSStorage.addResource(resourceEntity);
    await this.offlineSecretsOPFSStorage.addSecret(resourceEntity.secrets.items[0]);
  }
}

export default MarkOfflineResourceService;
