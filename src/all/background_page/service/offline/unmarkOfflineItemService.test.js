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

describe("UnmarkOfflineItemService", () => {
  let apiClientOptions, account;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
    // Keep the OPFS-side cleanup inert across this suite.
    jest.spyOn(OfflineResourcesOPFSStorage.prototype, "delete").mockResolvedValue();
    jest.spyOn(OfflineSecretsOPFSStorage.prototype, "deleteByResourceId").mockResolvedValue();
  });

  describe("::create", () => {
    it("successfully unmark a resource available offline", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${offlineItemId}`), () => mockApiResponse(null));

      const service = new UnmarkOfflineItemService(account, apiClientOptions);
      const result = await service.delete(offlineItemId);

      expect(result).toEqual(null);
    });

    it("throws an Error if the parameter is not a valid uuid", async () => {
      expect.assertions(1);
      const service = new UnmarkOfflineItemService(account, apiClientOptions);

      await expect(() => service.delete({})).rejects.toThrow("The given parameter is not a valid UUID");
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${offlineItemId}`), () => {
        throw new Error("Service unavailable");
      });

      const service = new UnmarkOfflineItemService(account, apiClientOptions);

      await expect(() => service.delete(offlineItemId)).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${offlineItemId}`), () =>
        mockApiResponseError(500, "Something wrong happened!"),
      );

      const service = new UnmarkOfflineItemService(account, apiClientOptions);

      await expect(() => service.delete(offlineItemId)).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
