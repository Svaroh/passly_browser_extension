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
import Log from "../../model/log";
import MetadataKeyEntity from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeyEntity";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import { assertType, assertUuid } from "../../utils/assertions";
import AccountEntity from "../../model/entity/account/accountEntity";
import OPFSJSONStore from "passbolt-styleguide/src/shared/utils/opfs/OPFSJsonStore";

export const OFFLINE_METADATA_KEYS_OPFS_STORAGE_KEY = "metadata_keys_offline";

class MetadataKeyOPFSStorage {
  /**
   * Runtime cached data.
   * @type {Object} Key: account_id, value: cached data as dto.
   * @private
   */
  static _runtimeCachedData = {};

  /**
   * Constructor
   * @param account the user account
   */
  constructor(account) {
    if (!account || !(account instanceof AccountEntity)) {
      throw new TypeError("Parameter `account` should be of type AccountEntity.");
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
    return `${OFFLINE_METADATA_KEYS_OPFS_STORAGE_KEY}-${account.id}`;
  }

  /**
   * Flush offline metadata keys from OPFS storage and runtime cached data.
   * @return {Promise<void>}
   */
  async flush() {
    Log.write({ level: "debug", message: "MetadataKeyOPFSStorage flushed" });
    await this.opfsStorage.delete(this.storageKey);
    delete MetadataKeyOPFSStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Get the offline metadata keys from the OPFS storage.
   * @return {Promise<array|undefined>}
   */
  async get() {
    if (!MetadataKeyOPFSStorage._runtimeCachedData[this.account.id]) {
      const data = await this.opfsStorage.get(this.storageKey);
      if (!data) {
        return;
      }
      MetadataKeyOPFSStorage._runtimeCachedData[this.account.id] = data;
    }

    return MetadataKeyOPFSStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Set the offline metadata keys in the OPFS storage.
   * @param {MetadataKeysCollection} metadataKeysCollection The metadata keys collection to insert in the OPFS storage.
   * @return {Promise<void>}
   * @throws {TypeError} If parameter is not of type MetadataKeysCollection.
   */
  async set(metadataKeysCollection) {
    assertType(
      metadataKeysCollection,
      MetadataKeysCollection,
      "The `metadataKeysCollection` parameter should be of type MetadataKeysCollection",
    );
    if (metadataKeysCollection.hasDecryptedKeys()) {
      throw new TypeError(
        "The `metadataKeysCollection` parameter should contain only encrypted metadata private keys.",
      );
    }
    await navigator.locks.request(this.storageKey, async () => {
      const metadataKeys = [];
      metadataKeysCollection.items.forEach((metadataKeyEntity) => {
        MetadataKeyOPFSStorage.assertEntityBeforeSave(metadataKeyEntity);
        metadataKeys.push(metadataKeyEntity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN));
      });
      await this._setOPFSStorage(this.storageKey, metadataKeys);
      MetadataKeyOPFSStorage._runtimeCachedData[this.account.id] = metadataKeys;
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
   * Get an offline metadata key from the OPFS storage by id.
   *
   * @param {string} id The metadata key id
   * @return {Promise<object|undefined>} metadata key dto
   */
  async getOfflineMetadataKeyById(id) {
    const metadataKeys = await this.get();
    return metadataKeys?.find((item) => item.id === id);
  }

  /**
   * Add an offline metadata key in the OPFS storage.
   * @param {MetadataKeyEntity} metadataKeyEntity
   */
  async addMetadataKey(metadataKeyEntity) {
    MetadataKeyOPFSStorage.assertEntityBeforeSave(metadataKeyEntity);
    await navigator.locks.request(this.storageKey, async () => {
      const metadataKeys = (await this.get()) || [];
      metadataKeys.push(metadataKeyEntity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN));
      await this._setOPFSStorage(this.storageKey, metadataKeys);
      MetadataKeyOPFSStorage._runtimeCachedData[this.account.id] = metadataKeys;
    });
  }

  /**
   * Update a metadata key in the OPFS storage.
   * @param {MetadataKeyEntity} metadataKeyEntity The offline metadata key to update
   * @throws {Error} if the metadata key does not exist in the OPFS storage
   */
  async updateMetadataKey(metadataKeyEntity) {
    MetadataKeyOPFSStorage.assertEntityBeforeSave(metadataKeyEntity);
    await navigator.locks.request(this.storageKey, async () => {
      const metadataKeys = (await this.get()) || [];
      const metadataKeyIndex = metadataKeys.findIndex((item) => item.id === metadataKeyEntity.id);
      if (metadataKeyIndex === -1) {
        throw new Error("The offline metadata key could not be found in the OPFS storage");
      }
      metadataKeys[metadataKeyIndex] = metadataKeyEntity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN);
      await this._setOPFSStorage(this.storageKey, metadataKeys);
      MetadataKeyOPFSStorage._runtimeCachedData[this.account.id] = metadataKeys;
    });
  }

  /**
   * Add or replace an offline metadata key collection in the OPFS storage.
   * @param {MetadataKeysCollection} metadataKeysCollection The offline metadata keys to upsert
   * @throws {TypeError} if parameter is not of MetadataKeysCollection type
   */
  async addOrReplaceMetadataKeysCollection(metadataKeysCollection) {
    assertType(
      metadataKeysCollection,
      MetadataKeysCollection,
      "The parameter `metadataKeysCollection` should be of type MetadataKeysCollection.",
    );
    if (metadataKeysCollection.hasDecryptedKeys()) {
      throw new TypeError(
        "The `metadataKeysCollection` parameter should contain only encrypted metadata private keys.",
      );
    }
    await navigator.locks.request(this.storageKey, async () => {
      const metadataKeys = (await this.get()) || [];
      metadataKeysCollection.items.forEach((metadataKeyEntity) => {
        MetadataKeyOPFSStorage.assertEntityBeforeSave(metadataKeyEntity);
        const metadataKeyIndex = metadataKeys.findIndex((item) => item.id === metadataKeyEntity.id);
        if (metadataKeyIndex === -1) {
          metadataKeys.push(metadataKeyEntity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN));
        } else {
          metadataKeys[metadataKeyIndex] = metadataKeyEntity.toDto(MetadataKeyOPFSStorage.DEFAULT_CONTAIN);
        }
      });
      await this._setOPFSStorage(this.storageKey, metadataKeys);
      MetadataKeyOPFSStorage._runtimeCachedData[this.account.id] = metadataKeys;
    });
  }

  /**
   * Delete an offline metadata key in the OPFS storage by id.
   * @param {string} metadataKeyId The metadata key id
   */
  async delete(metadataKeyId) {
    assertUuid(metadataKeyId, "The parameter metadataKeyId should be a UUID.");
    await navigator.locks.request(this.storageKey, async () => {
      const metadataKeys = (await this.get()) || [];
      if (metadataKeys.length > 0) {
        const metadataKeyIndex = metadataKeys.findIndex((item) => item.id === metadataKeyId);
        if (metadataKeyIndex !== -1) {
          metadataKeys.splice(metadataKeyIndex, 1);
          await this._setOPFSStorage(this.storageKey, metadataKeys);
          MetadataKeyOPFSStorage._runtimeCachedData[this.account.id] = metadataKeys;
        }
      }
    });
  }

  /*
   * =================================================
   * Static methods
   * =================================================
   */
  /**
   * MetadataKeyOPFSStorage.DEFAULT_CONTAIN
   * Warning: To be used for entity serialization not service API contain!
   *
   * @returns {Object}
   * @private
   */
  static get DEFAULT_CONTAIN() {
    return { metadata_private_keys: true, creator: true };
  }

  /**
   * Make sure the entity meets the minimal requirements before being stored.
   *
   * @param {MetadataKeyEntity} metadataKeyEntity
   * @throw {TypeError} if requirements are not met
   * @private
   */
  static assertEntityBeforeSave(metadataKeyEntity) {
    if (!metadataKeyEntity) {
      throw new TypeError("MetadataKeyOPFSStorage expects a MetadataKeyEntity to be set");
    }
    if (!(metadataKeyEntity instanceof MetadataKeyEntity)) {
      throw new TypeError("MetadataKeyOPFSStorage expects an object of type MetadataKeyEntity");
    }
    if (!metadataKeyEntity.id) {
      throw new TypeError("MetadataKeyOPFSStorage expects MetadataKeyEntity id to be set");
    }
    if (typeof metadataKeyEntity._metadata_private_keys === "undefined") {
      throw new TypeError(
        "MetadataKeyOPFSStorage expects MetadataKeyEntity metadata_private_keys association to be set",
      );
    }
    if (metadataKeyEntity.metadataPrivateKeys?.hasDecryptedPrivateKeys()) {
      throw new TypeError("MetadataKeyOPFSStorage expects MetadataKeyEntity metadata_private_keys to be encrypted");
    }
  }
}

export default MetadataKeyOPFSStorage;
