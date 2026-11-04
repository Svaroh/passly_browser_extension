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
import DecryptMetadataService from "../metadata/decryptMetadataService";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import GetOrFindResourceTypesService from "../resourceType/getOrFindResourceTypesService";
import Log from "../../model/log";

export default class ChangesApplier {
  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   * @param {SyncStateLocalStorage} syncStateLocalStorage
   */
  constructor(account, apiClientOptions, syncStateLocalStorage) {
    this.account = account;
    this.apiClientOptions = apiClientOptions;
    this.syncStateLocalStorage = syncStateLocalStorage;
    this.decryptMetadataService = new DecryptMetadataService(apiClientOptions, account);
    this.canUseOfflineStorageService = new CanUseOfflineStorageService(account, apiClientOptions);
    this.offlineResourcesOPFSStorage = new OfflineResourcesOPFSStorage(account);
    this.offlineSecretsOPFSStorage = new OfflineSecretsOPFSStorage(account);
    this.getOrFindResourceTypesService = new GetOrFindResourceTypesService(account, apiClientOptions);
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

    // 1. Process Resource deletions
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

    // 2. Process Resource upserts
    if (Array.isArray(upserts.resources) && upserts.resources.length > 0) {
      const freshCollection = new ResourcesCollection(upserts.resources, {
        clone: false,
        ignoreInvalidEntity: true,
      });

      const resourceTypes = await this.getOrFindResourceTypesService.getOrFindAll();
      freshCollection.filterByResourceTypes(resourceTypes);

      if (canUseOffline) {
        const clonedEncryptedItems = freshCollection.items
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
      freshCollection.filterOutMetadataEncrypted();

      await ResourceLocalStorage.addOrReplaceResourcesCollection(freshCollection);
    }

    // 3. Process Secret upserts
    if (canUseOffline && Array.isArray(upserts.secrets) && upserts.secrets.length > 0) {
      try {
        const secretsCollection = new SecretsCollection(upserts.secrets, { validate: false });
        await this.offlineSecretsOPFSStorage.addOrReplaceSecretsCollection(secretsCollection);
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
        clone: false,
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
    if (Array.isArray(upserts.resource_types) && upserts.resource_types.length > 0) {
      const resourceTypeLocalStorage = new ResourceTypeLocalStorage(this.account);
      const existingTypes = (await resourceTypeLocalStorage.get()) || [];
      const typeMap = new Map(existingTypes.map((t) => [t.id, t]));
      upserts.resource_types.forEach((dto) => typeMap.set(dto.id, dto));
      await resourceTypeLocalStorage.set(new ResourceTypesCollection(Array.from(typeMap.values())));
    }

    // 8. Commit updated cursor and epoch atomically with the data
    if (cursor !== undefined && cursor !== null) {
      await this.syncStateLocalStorage.updateCursor(cursor, epoch);
    }
  }
}
