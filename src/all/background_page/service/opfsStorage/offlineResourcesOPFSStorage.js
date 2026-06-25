/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SARL (https://www.passbolt.com)
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
import Log from "../../model/log";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import ResourceEntity from "../../model/entity/resource/resourceEntity";
import { assertArrayUUID, assertType, assertUuid } from "../../utils/assertions";
import AccountEntity from "../../model/entity/account/accountEntity";
import OPFSJSONStore from "passbolt-styleguide/src/shared/utils/opfs/OPFSJsonStore";
import FavoriteEntity from "../../model/entity/favorite/favoriteEntity";

export const OFFLINE_RESOURCES_OPFS_STORAGE_KEY = "resources_offline";

class OfflineResourcesOPFSStorage {
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
    this.opfsStorage = new OPFSJSONStore(this.storageKey);
  }

  /**
   * Get the storage key.
   * @param {AbstractAccountEntity} account The account to get the key for.
   * @returns {string}
   * @throws {Error} If it cannot retrieve account id.
   */
  getStorageKey(account) {
    return `${OFFLINE_RESOURCES_OPFS_STORAGE_KEY}-${account.id}`;
  }

  /**
   * Flush offline resources from OPFS storage and runtime cached data.
   * @return {Promise<void>}
   */
  async flush() {
    Log.write({ level: "debug", message: "OfflineResourcesOPFSStorage flushed" });
    await this.opfsStorage.delete(this.storageKey);
    delete OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Get the offline resources from the OPFS storage.
   * @return {Promise<object|undefined>}
   */
  async get() {
    if (!OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id]) {
      const data = await this.opfsStorage.get(this.storageKey);
      if (!data) {
        return;
      }
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = data;
    }

    return OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Set the offline resources in the OPFS storage.
   * @param {ResourcesCollection} resourcesCollection The resource to insert in the OPFS storage.
   * @return {Promise<void>}
   * @throws {TypeError} If parameter settings is not of key ResourcesCollection.
   */
  async set(resourcesCollection) {
    assertType(
      resourcesCollection,
      ResourcesCollection,
      "The `resourcesCollection` parameter should be of type ResourcesCollection",
    );
    await navigator.locks.request(this.storageKey, async () => {
      const resources = [];
      resourcesCollection.items.forEach((resourceEntity) => {
        OfflineResourcesOPFSStorage.assertEntityBeforeSave(resourceEntity);
        resources.push(resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN));
      });
      await this._setOPFSStorage(this.storageKey, resources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
    });
  }

  /**
   * Set the OPFS storage.
   * @param {string} key The key to store in the OPFS storage.
   * @param {object} data The data to store in the OPFS storage.
   * @returns {Promise<void>}
   * @private
   */
  async _setOPFSStorage(key, data) {
    await this.opfsStorage.set(key, data);
  }

  /**
   * Get an offline resource from the OPFS storage by id
   *
   * @param {string} id The resource id
   * @return {Promise<object>} resource dto object
   */
  async getOfflineResourceById(id) {
    const resources = await this.get();
    return resources?.find((item) => item.id === id);
  }

  /**
   * Get offline resources from the OPFS storage by ids
   *
   * @param {Array<string>} ids The resource ids
   * @return {Promise<Array<object>>} resource dto object
   */
  async getOfflineResourcesByIds(ids) {
    const resources = await this.get();
    return resources?.filter((item) => ids.includes(item.id));
  }

  /**
   * Add an offline resource in the OPFS storage
   * @param {ResourceEntity} resourceEntity
   */
  async addResource(resourceEntity) {
    OfflineResourcesOPFSStorage.assertEntityBeforeSave(resourceEntity);
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      resources.push(resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN));
      await this._setOPFSStorage(this.storageKey, resources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
    });
  }

  /**
   * Add multiple offline resources to the OPFS storage
   * @param {ResourcesCollection} resources The offline resources to add to the storage.
   */
  async addResources(resources) {
    assertType(resources, ResourcesCollection, "The `resources` parameter should be of type ResourcesCollection");
    await navigator.locks.request(this.storageKey, async () => {
      const storedResources = (await this.get()) || [];
      resources.items.forEach((resourceEntity) => {
        OfflineResourcesOPFSStorage.assertEntityBeforeSave(resourceEntity);
        storedResources.push(resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN));
      });
      await this._setOPFSStorage(this.storageKey, storedResources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = storedResources;
    });
  }

  /**
   * Update a resource in the OPFS storage.
   * @param {ResourceEntity} resourceEntity The offline resource to update
   * @throws {Error} if the resource does not exist in the OPFS storage
   */
  async updateResource(resourceEntity) {
    OfflineResourcesOPFSStorage.assertEntityBeforeSave(resourceEntity);
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      const resourceIndex = resources.findIndex((item) => item.id === resourceEntity.id);
      if (resourceIndex === -1) {
        throw new Error("The offline resource could not be found in the OPFS storage");
      }
      resources[resourceIndex] = resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN);
      await this._setOPFSStorage(this.storageKey, resources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
    });
  }

  /**
   * Update a resource favorite in the OPFS storage.
   * @param {string} resourceId The resource id
   * @param {FavoriteEntity} favoriteEntity The favorite entity
   * @throws {Error} if the offline resource does not exist in the OPFS storage
   */
  async updateResourceFavorite(resourceId, favoriteEntity) {
    assertUuid(resourceId, "The parameter resourceId should be a UUID.");
    assertType(favoriteEntity, FavoriteEntity, "The `favoriteEntity` parameter should be of type FavoriteEntity");
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      const resourceIndex = resources.findIndex((item) => item.id === resourceId);
      if (resourceIndex === -1) {
        throw new Error("The offline resource could not be found in the OPFS storage");
      }
      resources[resourceIndex].favorite = favoriteEntity.toDto();
      await this._setOPFSStorage(this.storageKey, resources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
    });
  }

  /**
   * Update an offline resource collection in the OPFS storage.
   * @param {ResourcesCollection} resourcesCollection The offline resources to update
   * @throws {Error} if the resource does not exist in the OPFS storage
   */
  async updateResourcesCollection(resourcesCollection) {
    assertType(
      resourcesCollection,
      ResourcesCollection,
      "The parameter resourcesEntities should be of ResourcesCollection type.",
    );
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      resourcesCollection.items.forEach((resourceEntity) => {
        OfflineResourcesOPFSStorage.assertEntityBeforeSave(resourceEntity);
        const resourceIndex = resources.findIndex((item) => item.id === resourceEntity.id);
        if (resourceIndex === -1) {
          throw new Error("The resource could not be found in the OPFS storage");
        }
        resources[resourceIndex] = resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN);
      });
      await this._setOPFSStorage(this.storageKey, resources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
    });
  }

  /**
   * Add or replace an offline resource collection in the OPFS storage.
   * @param {ResourcesCollection} resourcesCollection The offline resources to update
   * @throws {Error} if parameter resourcesCollection is not of ResourcesCollection type
   */
  async addOrReplaceResourcesCollection(resourcesCollection) {
    assertType(
      resourcesCollection,
      ResourcesCollection,
      "The parameter resourcesEntities should be of ResourcesCollection type.",
    );
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      resourcesCollection.items.forEach((resourceEntity) => {
        OfflineResourcesOPFSStorage.assertEntityBeforeSave(resourceEntity);
        const resourceIndex = resources.findIndex((item) => item.id === resourceEntity.id);
        if (resourceIndex === -1) {
          resources.push(resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN));
        } else {
          resources[resourceIndex] = resourceEntity.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN);
        }
      });
      await this._setOPFSStorage(this.storageKey, resources);
      OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
    });
  }

  /**
   * Delete an offline resource in the OPFS storage by id.
   * @param {string} resourceId The resource id
   */
  async delete(resourceId) {
    assertUuid(resourceId, "The parameter resourceId should be a UUID.");
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      if (resources.length > 0) {
        const resourceIndex = resources.findIndex((item) => item.id === resourceId);
        if (resourceIndex !== -1) {
          resources.splice(resourceIndex, 1);
        }
        await this._setOPFSStorage(this.storageKey, resources);
        OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = resources;
      }
    });
  }

  /**
   * Delete multiple offline resources in OPFS storage by Id
   * @param {Array<string>} resourceIds
   */
  async deleteResources(resourceIds) {
    assertArrayUUID(resourceIds);
    await navigator.locks.request(this.storageKey, async () => {
      const resources = (await this.get()) || [];
      if (resources.length > 0 && resourceIds.length > 0) {
        const setOfResourceIds = new Set(resourceIds);

        const filteredResources = resources.filter((resource) => !setOfResourceIds.has(resource.id));

        await this._setOPFSStorage(this.storageKey, filteredResources);
        OfflineResourcesOPFSStorage._runtimeCachedData[this.account.id] = filteredResources;
      }
    });
  }

  /*
   * =================================================
   * Static methods
   * =================================================
   */
  /**
   * OfflineResourcesOPFSStorage.DEFAULT_CONTAIN
   * Warning: To be used for entity serialization not service API contain!
   *
   * @returns {Object}
   * @private
   */
  static get DEFAULT_CONTAIN() {
    return { permission: true, favorite: true, tag: true, offline: true };
  }

  /**
   * Make sure the entity meet some minimal requirements before being stored
   *
   * @param {ResourceEntity} resourceEntity
   * @throw {TypeError} if requirements are not met
   * @private
   */
  static assertEntityBeforeSave(resourceEntity) {
    if (!resourceEntity) {
      throw new TypeError("OfflineResourcesOPFSStorage expects a ResourceEntity to be set");
    }
    if (!(resourceEntity instanceof ResourceEntity)) {
      throw new TypeError("OfflineResourcesOPFSStorage expects an object of type ResourceEntity");
    }
    if (!resourceEntity.id) {
      throw new TypeError("OfflineResourcesOPFSStorage expects ResourceEntity id to be set");
    }
    if (!resourceEntity.permission) {
      throw new TypeError("OfflineResourcesOPFSStorage::set expects ResourceEntity permission to be set");
    }
    if (resourceEntity.isMetadataDecrypted()) {
      throw new TypeError("OfflineResourcesOPFSStorage::set expects ResourceEntity metadata to be encrypted");
    }
  }
}

export default OfflineResourcesOPFSStorage;
