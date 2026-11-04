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
import SyncStateLocalStorage from "../local_storage/syncStateLocalStorage";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";
import GetOrFindResourceTypesService from "../resourceType/getOrFindResourceTypesService";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import { defaultUserDto } from "passbolt-styleguide/src/shared/models/entity/user/userEntity.test.data";

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
  });
});
