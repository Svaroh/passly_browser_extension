/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Passly (https://passly.svaroh.net)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passly (https://passly.svaroh.net)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 */
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import FolderLocalStorage from "../local_storage/folderLocalStorage";
import UserLocalStorage from "../local_storage/userLocalStorage";
import GroupLocalStorage from "../local_storage/groupLocalStorage";
import ResourceTypeLocalStorage from "../local_storage/resourceTypeLocalStorage";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import ResourceEntity from "../../model/entity/resource/resourceEntity";
import FoldersCollection from "../../model/entity/folder/foldersCollection";
import UserEntity from "passbolt-styleguide/src/shared/models/entity/user/userEntity";
import GroupEntity from "passbolt-styleguide/src/shared/models/entity/group/groupEntity";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import SecretsCollection from "passbolt-styleguide/src/shared/models/entity/secret/secretsCollection";
import MetadataKeysCollection from "passbolt-styleguide/src/shared/models/entity/metadata/metadataKeysCollection";
import DecryptMetadataService from "../metadata/decryptMetadataService";
import DecryptMetadataPrivateKeysService from "../metadata/decryptMetadataPrivateKeysService";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import MetadataKeyOPFSStorage from "../opfsStorage/metadataKeyOPFSStorage";
import MetadataKeysSessionStorage from "../session_storage/metadataKeysSessionStorage";
import GetOrFindResourceTypesService from "../resourceType/getOrFindResourceTypesService";
import Log from "../../model/log";

export default class ChangesApplier {
  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   * @param {SyncStateLocalStorage} syncStateLocalStorage
   * @param {Object} [dependencies={}] Optional dependency overrides for testing
   */
  constructor(account, apiClientOptions, syncStateLocalStorage, dependencies = {}) {
    this.account = account;
    this.apiClientOptions = apiClientOptions;
    this.syncStateLocalStorage = syncStateLocalStorage;
    this.decryptMetadataService =
      dependencies.decryptMetadataService || new DecryptMetadataService(apiClientOptions, account);
    this.decryptMetadataPrivateKeysService =
      dependencies.decryptMetadataPrivateKeysService || new DecryptMetadataPrivateKeysService(account);
    this.canUseOfflineStorageService =
      dependencies.canUseOfflineStorageService || new CanUseOfflineStorageService(account, apiClientOptions);
    this.offlineResourcesOPFSStorage =
      dependencies.offlineResourcesOPFSStorage || new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = dependencies.offlineSecretsOPFSStorage || new OfflineSecretsOPFSStorage(account);
    this.getOrFindResourceTypesService =
      dependencies.getOrFindResourceTypesService || new GetOrFindResourceTypesService(account, apiClientOptions);
    this.metadataKeysSessionStorage =
      dependencies.metadataKeysSessionStorage || new MetadataKeysSessionStorage(account);
    this.metadataKeyOPFSStorage = dependencies.metadataKeyOPFSStorage || new MetadataKeyOPFSStorage(account);
  }

  /**
   * Apply a sync page (upserts + deletions + cursor update).
   * @param {Object} pageData Server response body from changes.json or bootstrap.json
   * @param {string|null} [passphrase=null]
   * @param {string|null} [epoch=null]
   * @returns {Promise<void>}
   */
  async apply(pageData, passphrase = null, epoch = null) {
    if (!pageData) {
      return;
    }

    const { upserts = {}, deletions = {}, cursor } = pageData;
    const canUseOffline = await this.canUseOfflineStorageService.canUseOfflineStorage();

    // 1. Process Metadata Keys upserts FIRST so decrypted metadata private keys are available for decrypting v5 resources
    if (Array.isArray(upserts.metadata_keys) && upserts.metadata_keys.length > 0) {
      try {
        const incomingCollection = new MetadataKeysCollection(upserts.metadata_keys, { validate: false });
        if (canUseOffline) {
          await this.metadataKeyOPFSStorage.addOrReplaceMetadataKeysCollection(incomingCollection);
        }

        try {
          await this.decryptMetadataPrivateKeysService.decryptAllFromMetadataKeysCollection(
            incomingCollection,
            passphrase,
          );
        } catch (decryptErr) {
          Log.write({
            level: "warn",
            message: `Metadata private keys decryption during sync deferred: ${decryptErr?.message}`,
          });
        }

        if (!incomingCollection.hasEncryptedKeys()) {
          const existingDtos = (await this.metadataKeysSessionStorage.get()) || [];
          const keyMap = new Map();
          existingDtos.forEach((dto) => keyMap.set(dto.id, dto));
          incomingCollection
            .toDto(MetadataKeysSessionStorage.DEFAULT_CONTAIN)
            .forEach((dto) => keyMap.set(dto.id, dto));
          const mergedCollection = new MetadataKeysCollection(Array.from(keyMap.values()), { validate: false });
          await this.metadataKeysSessionStorage.set(mergedCollection);
        }
      } catch (error) {
        Log.write({ level: "warn", message: `Metadata keys upsert error: ${error?.message}` });
      }
    }

    // 2. Process Resource deletions
    if (Array.isArray(deletions.resources) && deletions.resources.length > 0) {
      await ResourceLocalStorage.deleteResources(deletions.resources);
      if (canUseOffline) {
        try {
          await this.offlineResourcesOPFSStorage.deleteResources(deletions.resources);
          await this.offlineSecretsOPFSStorage.deleteByResourceIds(deletions.resources);
        } catch (error) {
          Log.write({ level: "warn", message: `OPFS deletion error: ${error?.message}` });
        }
      }
    }

    // 3. Process Resource upserts
    if (Array.isArray(upserts.resources) && upserts.resources.length > 0) {
      const freshCollection = new ResourcesCollection(upserts.resources, {
        clone: false,
        ignoreInvalidEntity: true,
      });

      const resourceTypes = await this.getOrFindResourceTypesService.getOrFindAll();
      freshCollection.filterByResourceTypes(resourceTypes);

      if (canUseOffline) {
        // Enforce per-resource offline selection: match legacy behavior (if tagged items exist use them, else full set)
        const offlineTagged = freshCollection.filterByOffline();
        const baseItems = offlineTagged.length > 0 ? offlineTagged.items : freshCollection.items;
        const clonedEncryptedItems = baseItems
          .filter((r) => r && Boolean(r.permission))
          .map((r) => new ResourceEntity(r.toDto(ResourceEntity.ALL_CONTAIN_OPTIONS), { validate: false }));

        if (clonedEncryptedItems.length > 0) {
          try {
            await this.offlineResourcesOPFSStorage.addOrReplaceResourcesCollection(
              new ResourcesCollection(clonedEncryptedItems, { validate: false }),
            );
          } catch (error) {
            Log.write({ level: "warn", message: `OPFS resource upsert error: ${error?.message}` });
          }
        }
      }

      // Preserve previously decrypted metadata if already present locally
      const existingLocalStorage = new ResourcesCollection((await ResourceLocalStorage.get()) || [], {
        validate: false,
      });
      freshCollection.setDecryptedMetadataFromCollection(existingLocalStorage);

      // Decrypt any remaining encrypted metadata
      await this.decryptMetadataService.decryptAllFromForeignModels(freshCollection, passphrase, {
        ignoreDecryptionError: true,
        updateSessionKeys: true,
      });

      // Track any resources that could not be decrypted so they can be re-fetched when passphrase is available
      const allFreshItems = Array.from(freshCollection);
      const undecryptableIds = allFreshItems
        .filter((r) => r && typeof r.isMetadataDecrypted === "function" && !r.isMetadataDecrypted())
        .map((r) => r.id)
        .filter(Boolean);

      if (undecryptableIds.length > 0) {
        Log.write({
          level: "warn",
          message: `${undecryptableIds.length} resources could not be decrypted; recording for deferred reconciliation.`,
        });
        await this.syncStateLocalStorage.recordPendingResourceIds(undecryptableIds);
      }

      freshCollection.filterOutMetadataEncrypted();
      await ResourceLocalStorage.addOrReplaceResourcesCollection(freshCollection);

      // Clean up successfully decrypted IDs from pending list
      const decryptedIds = Array.from(freshCollection)
        .map((r) => r.id)
        .filter(Boolean);
      if (decryptedIds.length > 0) {
        await this.syncStateLocalStorage.removePendingResourceIds(decryptedIds);
      }
    }

    // 4. Process Secret upserts
    if (canUseOffline && Array.isArray(upserts.secrets) && upserts.secrets.length > 0) {
      try {
        // Enforce per-resource offline selection: only persist secrets for resources present in offline OPFS
        const offlineResources = (await this.offlineResourcesOPFSStorage.get()) || [];
        const offlineResourceIds = new Set(offlineResources.map((r) => r.id).filter(Boolean));

        const eligibleSecrets = upserts.secrets.filter((s) => s && offlineResourceIds.has(s.resource_id));
        if (eligibleSecrets.length > 0) {
          const secretsCollection = new SecretsCollection(eligibleSecrets, { validate: false });
          await this.offlineSecretsOPFSStorage.addOrReplaceSecretsCollection(secretsCollection);
        }
      } catch (error) {
        Log.write({ level: "warn", message: `OPFS secret upsert error: ${error?.message}` });
      }
    }

    // 4. Process Folders
    if (Array.isArray(deletions.folders) && deletions.folders.length > 0) {
      for (const folderId of deletions.folders) {
        await FolderLocalStorage.delete(folderId);
      }
    }
    if (Array.isArray(upserts.folders) && upserts.folders.length > 0) {
      const existingFolders = (await FolderLocalStorage.get()) || [];
      const folderMap = new Map(existingFolders.map((f) => [f.id, f]));
      upserts.folders.forEach((dto) => folderMap.set(dto.id, dto));
      const mergedFolders = Array.from(folderMap.values());
      const foldersCollection = new FoldersCollection(mergedFolders, {
        clone: true,
        ignoreInvalidEntity: true,
      });
      await FolderLocalStorage.set(foldersCollection);
    }

    // 5. Process Users
    if (Array.isArray(deletions.users) && deletions.users.length > 0) {
      for (const userId of deletions.users) {
        await UserLocalStorage.delete(userId);
      }
    }
    if (Array.isArray(upserts.users) && upserts.users.length > 0) {
      for (const userDto of upserts.users) {
        try {
          const userEntity = new UserEntity(userDto);
          const existing = await UserLocalStorage.getUserById(userEntity.id);
          if (existing) {
            await UserLocalStorage.updateUser(userEntity);
          } else {
            await UserLocalStorage.addUser(userEntity);
          }
        } catch (error) {
          Log.write({ level: "warn", message: `User apply error: ${error?.message}` });
        }
      }
    }

    // 6. Process Groups
    const groupLocalStorage = new GroupLocalStorage(this.account);
    if (Array.isArray(deletions.groups) && deletions.groups.length > 0) {
      for (const groupId of deletions.groups) {
        await groupLocalStorage.delete(groupId);
      }
    }
    if (Array.isArray(upserts.groups) && upserts.groups.length > 0) {
      for (const groupDto of upserts.groups) {
        try {
          const groupEntity = new GroupEntity(groupDto);
          const existing = await groupLocalStorage.getGroupById(groupEntity.id);
          if (existing) {
            await groupLocalStorage.updateGroup(groupEntity);
          } else {
            await groupLocalStorage.addGroup(groupEntity);
          }
        } catch (error) {
          Log.write({ level: "warn", message: `Group apply error: ${error?.message}` });
        }
      }
    }

    // 7. Process Resource Types
    const hasResourceTypeDeletions = Array.isArray(deletions.resource_types) && deletions.resource_types.length > 0;
    const hasResourceTypeUpserts = Array.isArray(upserts.resource_types) && upserts.resource_types.length > 0;
    if (hasResourceTypeDeletions || hasResourceTypeUpserts) {
      const resourceTypeLocalStorage = new ResourceTypeLocalStorage(this.account);
      const existingTypes = (await resourceTypeLocalStorage.getData()) || new ResourceTypesCollection([]);
      const deleteIds = new Set(deletions.resource_types || []);
      const typeMap = new Map();
      Array.from(existingTypes)
        .filter((t) => !deleteIds.has(t.id))
        .forEach((t) => typeMap.set(t.id, t.toDto ? t.toDto() : t));
      if (hasResourceTypeUpserts) {
        upserts.resource_types.forEach((dto) => typeMap.set(dto.id, dto));
      }
      await resourceTypeLocalStorage.setData(
        new ResourceTypesCollection(Array.from(typeMap.values()), { clone: false, ignoreInvalidEntity: true }),
      );
    }

    // 8. Commit updated cursor and epoch atomically with the data
    if (cursor !== undefined && cursor !== null) {
      await this.syncStateLocalStorage.updateCursor(cursor, epoch);
    }
  }
}
