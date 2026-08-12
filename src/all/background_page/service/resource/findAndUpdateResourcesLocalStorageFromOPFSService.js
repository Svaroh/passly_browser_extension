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
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import DecryptMetadataService from "../metadata/decryptMetadataService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import GetOrFindResourceTypesService from "../resourceType/getOrFindResourceTypesService";

const RESOURCES_UPDATE_ALL_OPFS_LS_LOCK_PREFIX = "RESOURCES_UPDATE_OPFS_LS_LOCK_";

/**
 * The service aims to find and update the resources local storage service from the OPFS store for offline mode.
 */
class FindAndUpdateResourcesLocalStorageFromOPFSService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.account = account;
    this.getOrFindResourceTypesService = new GetOrFindResourceTypesService(account, apiClientOptions);
    this.decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
  }

  /**
   * Find and update the local storage with all the resources retrieved from the OPFS storage.
   * @param {string|null} [passphrase = null] The passphrase to use to decrypt the metadata. Marked as optional as it
   * might be available in the passphrase session storage.
   *
   * 1. Get the resources from the OPFS storage
   * 2. Filter them by supported resourcetypes
   * 3. Decrypt the resources by using the user private key or metadata private key
   * 4. Filter out resources still with encrypted metadata
   * 5. Set the resources local storage
   * 6. Return the collection.
   *
   * @return {Promise<ResourcesCollection>}
   */
  async findAndUpdateAll(passphrase = null) {
    const lockKey = `${RESOURCES_UPDATE_ALL_OPFS_LS_LOCK_PREFIX}${this.account.id}`;
    const localStorageResourceCollection = await ResourceLocalStorage.get();

    // If no update is in progress, refresh the local storage.
    return await navigator.locks.request(lockKey, { ifAvailable: true }, async (lock) => {
      // Lock not granted, an update is already in progress. Wait for its completion to notify the function consumer.
      if (!lock) {
        return await navigator.locks.request(
          lockKey,
          { mode: "shared" },
          async () => new ResourcesCollection(localStorageResourceCollection, { validate: false }),
        );
      }

      // Lock is granted, read the resources from the OPFS storage and update the local storage.
      const resourcesCollection = new ResourcesCollection((await this.offlineResourcesOPFSStorage.get()) || []);
      const resourceTypes = await this.getOrFindResourceTypesService.getOrFindAll();
      resourcesCollection.filterByResourceTypes(resourceTypes);

      await this.decryptMetadataService.decryptAllFromForeignModelsWithSharedKey(resourcesCollection, passphrase, {
        ignoreDecryptionError: true,
      });

      await this.decryptMetadataService.decryptAllFromForeignModelsWithUserKey(resourcesCollection, passphrase, {
        ignoreDecryptionError: true,
      });
      resourcesCollection.filterOutMetadataEncrypted();

      await ResourceLocalStorage.set(resourcesCollection);

      return resourcesCollection;
    });
  }
}

export default FindAndUpdateResourcesLocalStorageFromOPFSService;
