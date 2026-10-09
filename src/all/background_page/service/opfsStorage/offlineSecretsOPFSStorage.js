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
import SecretEntity from "passbolt-styleguide/src/shared/models/entity/secret/secretEntity";
import { assertType } from "../../utils/assertions";
import { assertArrayUUID, assertUuid } from "passbolt-styleguide/src/shared/utils/assertions";
import AccountEntity from "../../model/entity/account/accountEntity";
import OPFSJSONStore from "passbolt-styleguide/src/shared/utils/opfs/OPFSJsonStore";
import SecretsCollection from "passbolt-styleguide/src/shared/models/entity/secret/secretsCollection";

export const OFFLINE_SECRETS_OPFS_STORAGE_KEY = "secrets_offline";

class OfflineSecretsOPFSStorage {
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
    return `${OFFLINE_SECRETS_OPFS_STORAGE_KEY}-${account.id}`;
  }

  /**
   * Flush offline resources from OPFS storage and runtime cached data.
   * @return {Promise<void>}
   */
  async flush() {
    Log.write({ level: "debug", message: "OfflineSecretsOPFSStorage flushed" });
    await this.opfsStorage.delete(this.storageKey);
    delete OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Get the offline resources from the OPFS storage.
   * @return {Promise<object|undefined>}
   */
  async get() {
    if (!OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id]) {
      const data = await this.opfsStorage.get(this.storageKey);
      if (!data) {
        return;
      }
      OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = data;
    }

    return OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id];
  }

  /**
   * Set the offline resources in the local storage.
   * @param {SecretsCollection} secretsCollection The resource to insert in the OPFS storage.
   * @return {Promise<void>}
   * @throws {TypeError} If parameter settings is not of key SecretsCollection.
   */
  async set(secretsCollection) {
    assertType(
      secretsCollection,
      SecretsCollection,
      "The `secretsCollection` parameter should be of type SecretsCollection",
    );
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = secretsCollection.toDto();
      await this._setOPFSStorage(this.storageKey, secrets);
      OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = secrets;
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
   * Get an offline secret from the OPFS storage by resource id
   *
   * @param {string} resourceId The resource id
   * @return {Promise<object>} resource dto object
   */
  async getOfflineSecretByResourceId(resourceId) {
    const secrets = await this.get();
    return secrets?.find((item) => item.resource_id === resourceId);
  }

  /**
   * Add an offline resource in the OPFS storage
   * @param {SecretEntity} secretEntity
   */
  async addSecret(secretEntity) {
    assertType(secretEntity, SecretEntity, "The `secretEntity` parameter should be of type SecretEntity");
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = (await this.get()) || [];
      secrets.push(secretEntity.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN));
      await this._setOPFSStorage(this.storageKey, secrets);
      OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = secrets;
    });
  }

  /**
   * Update a secret in the OPFS storage, matched by its resource id.
   *
   * The store holds a single secret per resource (the current user's), and the API regenerates the
   * secret id whenever the secret is updated, so the secret is matched by resource id rather than by
   * its own id.
   *
   * @param {SecretEntity} secretEntity The offline secret to update
   * @throws {Error} if the secret does not exist in the OPFS storage
   */
  async updateSecret(secretEntity) {
    assertType(secretEntity, SecretEntity, "The `secretEntity` parameter should be of type SecretEntity");
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = (await this.get()) || [];
      const secretIndex = secrets.findIndex((item) => item.resource_id === secretEntity.resourceId);
      if (secretIndex === -1) {
        throw new Error("The offline secret could not be found in the OPFS storage");
      }
      secrets[secretIndex] = secretEntity.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN);
      await this._setOPFSStorage(this.storageKey, secrets);
      OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = secrets;
    });
  }

  /**
   * Update an offline secret collection in the OPFS storage.
   * @param {SecretsCollection} secretsCollection The offline secrets to update
   * @throws {Error} if the secret does not exist in the OPFS storage
   */
  async updateSecretsCollection(secretsCollection) {
    assertType(
      secretsCollection,
      SecretsCollection,
      "The parameter secretsCollection should be of SecretsCollection type.",
    );
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = (await this.get()) || [];
      secretsCollection.items.forEach((secretEntity) => {
        const secretIndex = secrets.findIndex((item) => item.resource_id === secretEntity.resourceId);
        if (secretIndex === -1) {
          throw new Error("The secret could not be found in the OPFS storage");
        }
        secrets[secretIndex] = secretEntity.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN);
      });
      await this._setOPFSStorage(this.storageKey, secrets);
      OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = secrets;
    });
  }

  /**
   * Add or replace an offline secret collection in the OPFS storage.
   * @param {SecretsCollection} secretsCollection The offline secrets to update
   * @throws {Error} if parameter secretsCollection is not of SecretsCollection type
   */
  async addOrReplaceSecretsCollection(secretsCollection) {
    assertType(
      secretsCollection,
      SecretsCollection,
      "The parameter secretsCollection should be of SecretsCollection type.",
    );
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = (await this.get()) || [];
      secretsCollection.items.forEach((secretEntity) => {
        const secretIndex = secrets.findIndex((item) => item.resource_id === secretEntity.resourceId);
        if (secretIndex === -1) {
          secrets.push(secretEntity.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN));
        } else {
          secrets[secretIndex] = secretEntity.toDto(OfflineSecretsOPFSStorage.DEFAULT_CONTAIN);
        }
      });
      await this._setOPFSStorage(this.storageKey, secrets);
      OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = secrets;
    });
  }

  /**
   * Delete an offline secret in the OPFS storage by resource id.
   * @param {string} resourceId The resource id
   */
  async deleteByResourceId(resourceId) {
    assertUuid(resourceId, "The parameter resourceId should be a UUID.");
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = (await this.get()) || [];
      if (secrets.length > 0) {
        const secretIndex = secrets.findIndex((item) => item.resource_id === resourceId);
        if (secretIndex !== -1) {
          secrets.splice(secretIndex, 1);
        }
        await this._setOPFSStorage(this.storageKey, secrets);
        OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = secrets;
      }
    });
  }

  /**
   * Delete multiple offline secrets in OPFS storage by resource Ids
   * @param {Array<string>} resourceIds
   */
  async deleteByResourceIds(resourceIds) {
    assertArrayUUID(resourceIds);
    await navigator.locks.request(this.storageKey, async () => {
      const secrets = (await this.get()) || [];
      if (secrets.length > 0 && resourceIds.length > 0) {
        const setOfResourceIds = new Set(resourceIds);

        const filteredSecrets = secrets.filter((secret) => !setOfResourceIds.has(secret.resource_id));

        await this._setOPFSStorage(this.storageKey, filteredSecrets);
        OfflineSecretsOPFSStorage._runtimeCachedData[this.account.id] = filteredSecrets;
      }
    });
  }

  /*
   * =================================================
   * Static methods
   * =================================================
   */
  /**
   * OfflineSecretsOPFSStorage.DEFAULT_CONTAIN
   * Warning: To be used for entity serialization not service API contain!
   *
   * @returns {Object}
   * @private
   */
  static get DEFAULT_CONTAIN() {
    return { data: true };
  }
}

export default OfflineSecretsOPFSStorage;
