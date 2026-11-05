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
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import ChangesApplier from "./changesApplier";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import FolderLocalStorage from "../local_storage/folderLocalStorage";
import UserLocalStorage from "../local_storage/userLocalStorage";
import ResourceTypeLocalStorage from "../local_storage/resourceTypeLocalStorage";
import SyncStateLocalStorage from "../local_storage/syncStateLocalStorage";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";
import GetOrFindResourceTypesService from "../resourceType/getOrFindResourceTypesService";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import { defaultUserDto } from "passbolt-styleguide/src/shared/models/entity/user/userEntity.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { defaultResourceMetadataDto } from "passbolt-styleguide/src/shared/models/entity/resource/metadata/resourceMetadataEntity.test.data";
import { defaultPermissionDto } from "passbolt-styleguide/src/shared/models/entity/permission/permissionEntity.test.data";

describe("ChangesApplier", () => {
  let account;
  let apiClientOptions;
  let syncStateLocalStorage;
  let applier;

  beforeEach(() => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    syncStateLocalStorage = new SyncStateLocalStorage(account);

    jest.spyOn(CanUseOfflineStorageService.prototype, "canUseOfflineStorage").mockResolvedValue(false);
    jest
      .spyOn(GetOrFindResourceTypesService.prototype, "getOrFindAll")
      .mockResolvedValue(new ResourceTypesCollection(resourceTypesCollectionDto()));

    applier = new ChangesApplier(account, apiClientOptions, syncStateLocalStorage);
  });

  afterEach(async () => {
    await ResourceLocalStorage.flush();
    await FolderLocalStorage.flush();
    await UserLocalStorage.flush();
    await syncStateLocalStorage.flush();
  });

  describe("::apply", () => {
    it("should safely handle null or empty pageData", async () => {
      await expect(applier.apply(null)).resolves.not.toThrow();
      await expect(applier.apply({})).resolves.not.toThrow();
    });

    it("should apply resource deletions and update cursor", async () => {
      jest.spyOn(ResourceLocalStorage, "deleteResources").mockResolvedValue();
      jest.spyOn(syncStateLocalStorage, "updateCursor").mockResolvedValue();

      const pageData = {
        cursor: 120,
        deletions: {
          resources: ["res-uuid-1", "res-uuid-2"],
        },
      };

      await applier.apply(pageData, null, "epoch-alpha");

      expect(ResourceLocalStorage.deleteResources).toHaveBeenCalledWith(["res-uuid-1", "res-uuid-2"]);
      expect(syncStateLocalStorage.updateCursor).toHaveBeenCalledWith(120, "epoch-alpha");
    });

    it("should apply folder deletions and upserts", async () => {
      jest.spyOn(FolderLocalStorage, "delete").mockResolvedValue();
      jest.spyOn(FolderLocalStorage, "get").mockResolvedValue([]);
      jest.spyOn(FolderLocalStorage, "set").mockResolvedValue();

      const pageData = {
        cursor: 130,
        upserts: {
          folders: [{ id: "73205316-2da1-4475-9c6a-6056f7ef5eb4", name: "Folder A", permission: { type: 15 } }],
        },
        deletions: {
          folders: ["93205316-2da1-4475-9c6a-6056f7ef5eb9"],
        },
      };

      await applier.apply(pageData);

      expect(FolderLocalStorage.delete).toHaveBeenCalledWith("93205316-2da1-4475-9c6a-6056f7ef5eb9");
      expect(FolderLocalStorage.set).toHaveBeenCalledTimes(1);
    });

    it("should apply user deletions and upserts", async () => {
      jest.spyOn(UserLocalStorage, "delete").mockResolvedValue();
      jest.spyOn(UserLocalStorage, "getUserById").mockResolvedValue(null);
      jest.spyOn(UserLocalStorage, "addUser").mockResolvedValue();

      const pageData = {
        cursor: 140,
        upserts: {
          users: [defaultUserDto({ id: "73205316-2da1-4475-9c6a-6056f7ef5eb5", username: "newuser@example.com" })],
        },
        deletions: {
          users: ["83205316-2da1-4475-9c6a-6056f7ef5eb8"],
        },
      };

      await applier.apply(pageData);

      expect(UserLocalStorage.delete).toHaveBeenCalledWith("83205316-2da1-4475-9c6a-6056f7ef5eb8");
      expect(UserLocalStorage.addUser).toHaveBeenCalledTimes(1);
    });

    it("should safely apply resource_types upserts and deletions via getData/setData", async () => {
      const getDataSpy = jest.spyOn(ResourceTypeLocalStorage.prototype, "getData").mockResolvedValue(
        new ResourceTypesCollection([
          { id: "rt-1", name: "Type 1" },
          { id: "rt-2", name: "Type 2" },
        ]),
      );
      const setDataSpy = jest.spyOn(ResourceTypeLocalStorage.prototype, "setData").mockResolvedValue();

      const pageData = {
        cursor: 150,
        upserts: {
          resource_types: [{ id: "rt-3", name: "Type 3" }],
        },
        deletions: {
          resource_types: ["rt-1"],
        },
      };

      await applier.apply(pageData);

      expect(getDataSpy).toHaveBeenCalled();
      expect(setDataSpy).toHaveBeenCalled();
      getDataSpy.mockRestore();
      setDataSpy.mockRestore();
    });

    it("should record undecryptable resource IDs into syncStateLocalStorage pending list", async () => {
      jest.spyOn(ResourceLocalStorage, "addOrReplaceResourcesCollection").mockResolvedValue();
      jest.spyOn(syncStateLocalStorage, "recordPendingResourceIds").mockResolvedValue();

      const resourceTypes = await applier.getOrFindResourceTypesService.getOrFindAll();
      const validTypeId = resourceTypes.extract("id")[0];

      // Mock decrypt to leave a resource undecrypted
      jest.spyOn(applier.decryptMetadataService, "decryptAllFromForeignModels").mockImplementation((collection) => {
        const item = Array.from(collection)[0];
        if (item) {
          item.isMetadataDecrypted = () => false;
        }
        return Promise.resolve();
      });

      const resourceId = "73205316-2da1-4475-9c6a-6056f7ef5eb1";
      const pageData = {
        cursor: 160,
        upserts: {
          resources: [
            defaultResourceDto({
              id: resourceId,
              resource_type_id: validTypeId,
              metadata: defaultResourceMetadataDto({ resource_type_id: validTypeId }),
              permission: defaultPermissionDto({ type: 15, aco_foreign_key: resourceId }),
            }),
          ],
        },
      };

      await applier.apply(pageData);

      expect(syncStateLocalStorage.recordPendingResourceIds).toHaveBeenCalledWith([resourceId]);
    });
  });
});
