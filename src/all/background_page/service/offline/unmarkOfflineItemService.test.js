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
 * @since         5.13.0
 */

import { enableFetchMocks } from "jest-fetch-mock";
import { mockApiResponse, mockApiResponseError } from "passbolt-styleguide/test/mocks/mockApiResponse";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import { v4 as uuidv4 } from "uuid";
import UnmarkOfflineItemService from "./unmarkOfflineItemService";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import OfflineResourcesOPFSStorage from "../opfsStorage/offlineResourcesOPFSStorage";
import OfflineSecretsOPFSStorage from "../opfsStorage/offlineSecretsOPFSStorage";
import ResourceLocalStorage from "../local_storage/resourceLocalStorage";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { defaultOfflineItemDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity.test.data";

describe("UnmarkOfflineItemService", () => {
  let apiClientOptions, account;

  beforeEach(async () => {
    jest.clearAllMocks();
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
    // Keep the OPFS-side cleanup inert across this suite.
    jest.spyOn(OfflineResourcesOPFSStorage.prototype, "delete").mockResolvedValue();
    jest.spyOn(OfflineSecretsOPFSStorage.prototype, "deleteByResourceId").mockResolvedValue();
    jest.spyOn(ResourceLocalStorage, "updateResource").mockResolvedValue();
  });

  describe("::delete", () => {
    it("successfully unmark a resource available offline", async () => {
      expect.assertions(5);
      const resourceId = uuidv4();
      const resourceDto = defaultResourceDto({
        id: resourceId,
        offline: defaultOfflineItemDto({ foreign_key: resourceId }),
      });
      const offlineItemId = resourceDto.offline.id;
      jest.spyOn(ResourceLocalStorage, "getResourceByOfflineItemId").mockResolvedValue(resourceDto);
      fetch.doMockOnceIf(new RegExp(`/offline/item/${offlineItemId}`), () => mockApiResponse(null));

      const service = new UnmarkOfflineItemService(account, apiClientOptions);
      const result = await service.delete(offlineItemId);

      expect(result).toEqual(null);
      // The offline property is cleared from the resource in local storage so the UI stops showing it as offline.
      expect(ResourceLocalStorage.updateResource).toHaveBeenCalledTimes(1);
      expect(ResourceLocalStorage.updateResource.mock.calls[0][0].offline).toBeNull();
      // OPFS cleanup is keyed by the resource id, not the offline item id.
      expect(OfflineResourcesOPFSStorage.prototype.delete).toHaveBeenCalledWith(resourceId);
      expect(OfflineSecretsOPFSStorage.prototype.deleteByResourceId).toHaveBeenCalledWith(resourceId);
    });

    it("does not touch local storage nor OPFS if the resource is not in local storage", async () => {
      expect.assertions(3);
      const offlineItemId = uuidv4();
      jest.spyOn(ResourceLocalStorage, "getResourceByOfflineItemId").mockResolvedValue(undefined);
      fetch.doMockOnceIf(new RegExp(`/offline/item/${offlineItemId}`), () => mockApiResponse(null));

      const service = new UnmarkOfflineItemService(account, apiClientOptions);
      const result = await service.delete(offlineItemId);

      expect(result).toEqual(null);
      expect(ResourceLocalStorage.updateResource).not.toHaveBeenCalled();
      expect(OfflineResourcesOPFSStorage.prototype.delete).not.toHaveBeenCalled();
    });

    it("throws an Error if the offline item id is not a valid uuid", async () => {
      expect.assertions(1);
      const service = new UnmarkOfflineItemService(account, apiClientOptions);

      await expect(() => service.delete({})).rejects.toThrow("The given parameter is not a valid UUID");
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/item/${offlineItemId}`), () => {
        throw new Error("Service unavailable");
      });

      const service = new UnmarkOfflineItemService(account, apiClientOptions);

      await expect(() => service.delete(offlineItemId)).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/item/${offlineItemId}`), () =>
        mockApiResponseError(500, "Something wrong happened!"),
      );

      const service = new UnmarkOfflineItemService(account, apiClientOptions);

      await expect(() => service.delete(offlineItemId)).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
