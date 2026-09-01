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
 * @since         4.6.0
 */
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import { assertNumber } from "../../utils/assertions";
import { assertUuid } from "passbolt-styleguide/src/shared/utils/assertions";
import FindResourcesService from "./findResourcesService";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import DecryptMetadataService from "../metadata/decryptMetadataService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";
import SecretsCollection from "passbolt-styleguide/src/shared/models/entity/secret/secretsCollection";
import GetOrFindResourceTypesService from "../resourceType/getOrFindResourceTypesService";

const RESOURCES_UPDATE_ALL_LS_LOCK_PREFIX = "RESOURCES_UPDATE_LS_LOCK_";

/**
 * The service aim to find and update the resources local storage service.
 */
class FindAndUpdateResourcesLocalStorage {
  /**
   * The last times the update all operation run, the object key represents the account id.
   * @type {object}
   * @private
   */
  static lastUpdateAllTimes = {};

  /**
   * @constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.account = account;
    this.findResourcesServices = new FindResourcesService(account, apiClientOptions);
    this.getOrFindResourceTypesService = new GetOrFindResourceTypesService(account, apiClientOptions);
    this.decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
    this.canUseOfflineStorageService = new CanUseOfflineStorageService(account, apiClientOptions);
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
  }

  /**
   * Find and update the local storage with all the resources retrieved from the API.
   * @param {object} [options={}] Options.
   * @param {number} [options.updatePeriodThreshold] Do not update the local storage if the threshold is not overdue.
   * @param {string|null} [passphrase = null] The passphrase to use to decrypt the metadata. Marked as optional as it
   * might be available in the passphrase session storage.
   * @return {Promise<ResourcesCollection>}
   */
  async findAndUpdateAll({ updatePeriodThreshold } = {}, passphrase = null) {
    assertNumber(updatePeriodThreshold, "Parameter updatePeriodThreshold should be a number.");

    const lockKey = `${RESOURCES_UPDATE_ALL_LS_LOCK_PREFIX}${this.account.id}`;
    const lastUpdateTime = FindAndUpdateResourcesLocalStorage.lastUpdateAllTimes[this.account.id] ?? null;

    const isRuntimeCacheInitialized = ResourceLocalStorage.hasCachedData();
    const localStorageResourceCollection = await ResourceLocalStorage.get();

    // Do not update the storage if the defined period, during which the local storage doesn't need to be refreshed, has not yet passed.
    if (updatePeriodThreshold && lastUpdateTime && Boolean(localStorageResourceCollection)) {
      if (Date.now() - lastUpdateTime < updatePeriodThreshold) {
        return new ResourcesCollection(localStorageResourceCollection, { validate: !isRuntimeCacheInitialized });
      }
    }

    // If no update is in progress, refresh the local storage.
    return await navigator.locks.request(lockKey, { ifAvailable: true }, async (lock) => {
      // Lock not granted, an update is already in progress. Wait for its completion to notify the function consumer.
      if (!lock) {
        return await navigator.locks.request(
          lockKey,
          { mode: "shared" },
          async () =>
            /*
             * Return the data from local storage while waiting for the update in progress.
             * @todo it does not return the latest information but the previous one.
             */
            new ResourcesCollection(localStorageResourceCollection, { validate: !isRuntimeCacheInitialized }),
        );
      }

      // Lock is granted, retrieve all resources and update the local storage.
      const localResourcesCollection = new ResourcesCollection(localStorageResourceCollection || [], {
        validate: isRuntimeCacheInitialized,
      });

      const canUseOffline = await this.canUseOfflineStorageService.canUseOfflineStorage();
      const updatedResourcesCollection = await this.findResourcesServices.findAllForLocalStorage();
      const resourceTypes = await this.getOrFindResourceTypesService.getOrFindAll();
      updatedResourcesCollection.filterByResourceTypes(resourceTypes);

      // Snapshot offline-tagged items with encrypted metadata before decryption mutates the collection.
      const offlineEncryptedResourcesCollection = canUseOffline ? updatedResourcesCollection.filterByOffline() : [];

      updatedResourcesCollection.setDecryptedMetadataFromCollection(localResourcesCollection);

      await this.decryptMetadataService.decryptAllFromForeignModels(updatedResourcesCollection, passphrase, {
        ignoreDecryptionError: true,
        updateSessionKeys: true,
      });
      updatedResourcesCollection.filterOutMetadataEncrypted();

      await ResourceLocalStorage.set(updatedResourcesCollection);

      await this._refreshOfflineOPFSStorage(offlineEncryptedResourcesCollection);

      FindAndUpdateResourcesLocalStorage.lastUpdateAllTimes[this.account.id] = Date.now();

      // Return the updated resources collection from the API
      return updatedResourcesCollection;
    });
  }

  /**
   * Refresh the offline OPFS stores from the latest fetch.
   *
   * - Disabled or no offline-tagged resources -> flush both stores.
   * - Otherwise -> persist the offline resources (encrypted metadata) and selectively re-fetch the
   *   secrets only for resources that are new or whose `modified` timestamp changed since the last
   *   cached snapshot. Secrets for resources that left the offline set are deleted.
   *
   * @param {ResourcesCollection} offlineEncryptedResourcesCollection Resources collection (with offline association, encrypted metadata).
   * @returns {Promise<void>}
   * @private
   */
  async _refreshOfflineOPFSStorage(offlineEncryptedResourcesCollection) {
    if (offlineEncryptedResourcesCollection.length === 0) {
      await this.offlineResourcesOPFSStorage.flush();
      await this.offlineSecretsOPFSStorage.flush();
      return;
    }

    // Diff against the cached snapshot. Resources whose "modified" matches the cache are unchanged
    // and their secrets are still valid - skip them entirely.
    const cachedResources = (await this.offlineResourcesOPFSStorage.get()) || [];
    const cachedById = new Map(cachedResources.map((r) => [r.id, r]));
    const freshIds = new Set(offlineEncryptedResourcesCollection.items.map((r) => r.id));

    const idsRequiringSecretFetch = offlineEncryptedResourcesCollection.items
      .filter((fresh) => cachedById.get(fresh.id)?.modified !== fresh.modified)
      .map((fresh) => fresh.id);
    const removedResourceIds = cachedResources.filter((r) => !freshIds.has(r.id)).map((r) => r.id);

    await this.offlineResourcesOPFSStorage.set(offlineEncryptedResourcesCollection);

    if (removedResourceIds.length > 0) {
      await this.offlineSecretsOPFSStorage.deleteByResourceIds(removedResourceIds);
    }

    if (idsRequiringSecretFetch.length === 0) {
      return;
    }

    const resourcesWithSecrets = await this.findResourcesServices.findAllByIdsForOffline(idsRequiringSecretFetch);
    const secretDtos = resourcesWithSecrets.items.map((resourceEntity) => resourceEntity.secrets.items[0].toDto());
    const secretsCollection = new SecretsCollection(secretDtos, { validate: false });
    await this.offlineSecretsOPFSStorage.addOrReplaceSecretsCollection(secretsCollection);
  }

  /**
   * Find and update the local storage with the resources filtered by group id retrieved from the API.
   * @param {string} groupId The group id to filter the resources with.
   * @param {string|null} [passphrase = null] The passphrase to use to decrypt the metadata. Marked as optional as it
   * might be available in the passphrase session storage.
   * @return {Promise<ResourcesCollection>} The resource shared with the group
   * @throw {TypeError} If the groupId is not valid UUID
   */
  async findAndUpdateByIsSharedWithGroup(groupId, passphrase = null) {
    const resourcesCollection = await this.findResourcesServices.findAllByIsSharedWithGroupForLocalStorage(
      groupId,
      passphrase,
    );
    await ResourceLocalStorage.addOrReplaceResourcesCollection(resourcesCollection);
    return resourcesCollection;
  }

  /**
   * Find and update the local storage with the resources filtered by parent folder id retrieved from the API.
   * @param {string} parentFolderId The parent folder id to filter the resources with.
   * @param {string|null} [passphrase = null] The passphrase to use to decrypt the metadata. Marked as optional as it
   * might be available in the passphrase session storage.
   * @return {Promise<ResourcesCollection>} The resource shared with the group
   * @throw {TypeError} If the parentFolderId is not valid UUID
   */
  async findAndUpdateAllByParentFolderId(parentFolderId, passphrase = null) {
    assertUuid(parentFolderId);
    const resourceTypes = await this.getOrFindResourceTypesService.getOrFindAll();

    const apiResourcesCollection =
      await this.findResourcesServices.findAllByParentFolderIdForLocalStorage(parentFolderId);
    apiResourcesCollection.filterByResourceTypes(resourceTypes);

    const apiResourcesCollectionMapIds = apiResourcesCollection.items.reduce((result, resource) => {
      result[resource.id] = resource;
      return result;
    }, {});

    const localStorageResourcesCollection = new ResourcesCollection(await ResourceLocalStorage.get(), {
      validate: false,
    });
    const knownResourcesCollectionInFolderIds = localStorageResourcesCollection.items.reduce((result, resource) => {
      if (resource.folderParentId === parentFolderId) {
        result.push(resource.id);
      }
      return result;
    }, Array(apiResourcesCollection.length));

    apiResourcesCollection.setDecryptedMetadataFromCollection(localStorageResourcesCollection);
    localStorageResourcesCollection.updateWithCollection(apiResourcesCollection);

    const movedOrRemovedResourcesIds = knownResourcesCollectionInFolderIds.filter(
      (id) => !apiResourcesCollectionMapIds[id],
    );
    if (movedOrRemovedResourcesIds.length > 0) {
      const updatedResources = await this.findResourcesServices.findAllByIdsForLocalStorage(movedOrRemovedResourcesIds);

      updatedResources.setDecryptedMetadataFromCollection(localStorageResourcesCollection);
      localStorageResourcesCollection.updateWithCollection(updatedResources);

      // These resources have been deleted (or permissions revoked) and need to be removed from the local storage.
      const remainingResourcesIds = movedOrRemovedResourcesIds.filter((id) => !updatedResources.getFirstById(id));

      localStorageResourcesCollection.removeMany(remainingResourcesIds);
    }

    await this.decryptMetadataService.decryptAllFromForeignModels(localStorageResourcesCollection, passphrase, {
      ignoreDecryptionError: true,
      updateSessionKeys: true,
    });
    localStorageResourcesCollection.filterOutMetadataEncrypted();

    await ResourceLocalStorage.set(localStorageResourcesCollection);
  }
}

export default FindAndUpdateResourcesLocalStorage;
