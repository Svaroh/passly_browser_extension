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
import ManifestReconciler from "./manifestReconciler";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import CanUseOfflineStorageService from "../offline/canUseOfflineStorageService";

describe("ManifestReconciler", () => {
  let account;
  let apiClientOptions;
  let syncApiService;
  let syncStateLocalStorage;
  let reconciler;

  beforeEach(() => {
    jest.clearAllMocks();
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    syncApiService = {
      getManifest: jest.fn(),
    };
    syncStateLocalStorage = {
      get: jest.fn().mockResolvedValue({ pendingResourceIds: [] }),
      recordReconciliation: jest.fn().mockResolvedValue(),
      removePendingResourceIds: jest.fn().mockResolvedValue(),
    };

    jest.spyOn(CanUseOfflineStorageService.prototype, "canUseOfflineStorage").mockResolvedValue(false);

    reconciler = new ManifestReconciler(account, apiClientOptions, syncApiService, syncStateLocalStorage);
  });

  afterEach(async () => {
    await ResourceLocalStorage.flush();
  });

  describe("::reconcile", () => {
    it("should detect revoked resources and purge them from ResourceLocalStorage", async () => {
      jest
        .spyOn(ResourceLocalStorage, "get")
        .mockResolvedValue([{ id: "res-kept-1" }, { id: "res-revoked-2" }, { id: "res-kept-3" }]);
      jest.spyOn(ResourceLocalStorage, "deleteResources").mockResolvedValue();

      syncApiService.getManifest.mockResolvedValue({
        body: [
          { id: "res-kept-1", modified: "2026-11-01" },
          { id: "res-kept-3", modified: "2026-11-01" },
        ],
      });

      const result = await reconciler.reconcile();

      expect(syncApiService.getManifest).toHaveBeenCalledWith("resources");
      expect(ResourceLocalStorage.deleteResources).toHaveBeenCalledWith(["res-revoked-2"]);
      expect(syncStateLocalStorage.recordReconciliation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        revokedCount: 1,
        revokedIds: ["res-revoked-2"],
        repairedCount: 0,
        repairedIds: [],
      });
    });

    it("should do nothing if local items match server manifest exactly", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([{ id: "res-kept-1" }]);
      jest.spyOn(ResourceLocalStorage, "deleteResources").mockResolvedValue();

      syncApiService.getManifest.mockResolvedValue({
        body: [{ id: "res-kept-1" }],
      });

      const result = await reconciler.reconcile();

      expect(ResourceLocalStorage.deleteResources).not.toHaveBeenCalled();
      expect(result.revokedCount).toBe(0);
      expect(result.repairedCount).toBe(0);
    });

    it("should detect missing and divergent resources and repair them via findAllByIdsForLocalStorage", async () => {
      jest.spyOn(ResourceLocalStorage, "get").mockResolvedValue([
        { id: "res-kept-1", modified: "2026-10-01" }, // divergent date
      ]);
      jest.spyOn(ResourceLocalStorage, "deleteResources").mockResolvedValue();
      jest.spyOn(ResourceLocalStorage, "addOrReplaceResourcesCollection").mockResolvedValue();

      const repairedCollection = [
        { id: "res-kept-1", modified: "2026-11-05", isMetadataDecrypted: () => true },
        { id: "res-missing-2", modified: "2026-11-05", isMetadataDecrypted: () => true },
      ];
      repairedCollection.filterOutMetadataEncrypted = jest.fn();

      reconciler.findResourcesService.findAllByIdsForLocalStorage = jest.fn().mockResolvedValue(repairedCollection);
      reconciler.decryptMetadataService.decryptAllFromForeignModels = jest.fn().mockResolvedValue();

      syncApiService.getManifest.mockResolvedValue({
        body: [
          { id: "res-kept-1", modified: "2026-11-05" },
          { id: "res-missing-2", modified: "2026-11-05" },
        ],
      });

      const result = await reconciler.reconcile("passphrase-xyz");

      expect(reconciler.findResourcesService.findAllByIdsForLocalStorage).toHaveBeenCalledWith([
        "res-kept-1",
        "res-missing-2",
      ]);
      expect(reconciler.decryptMetadataService.decryptAllFromForeignModels).toHaveBeenCalledWith(
        repairedCollection,
        "passphrase-xyz",
        expect.any(Object),
      );
      expect(ResourceLocalStorage.addOrReplaceResourcesCollection).toHaveBeenCalledWith(repairedCollection);
      expect(result.repairedCount).toBe(2);
      expect(result.repairedIds).toEqual(["res-kept-1", "res-missing-2"]);
    });
  });
});
