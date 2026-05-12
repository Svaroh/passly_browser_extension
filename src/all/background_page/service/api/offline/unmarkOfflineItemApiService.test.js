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
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import { v4 as uuidv4 } from "uuid";
import UnmarkOfflineItemApiService from "./unmarkOfflineItemApiService";

describe("UnmarkOfflineItemApiService", () => {
  let apiClientOptions;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::delete", () => {
    it("delete the offline item on the API", async () => {
      expect.assertions(2);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${offlineItemId}`), () => mockApiResponse(null));

      const service = new UnmarkOfflineItemApiService(apiClientOptions);
      const result = await service.delete(offlineItemId);

      expect(result).toBeInstanceOf(PassboltResponseEntity);
      expect(result.body).toStrictEqual(null);
    });

    it("throws a TypeError if the parameter is not an valid id", async () => {
      expect.assertions(1);
      const service = new UnmarkOfflineItemApiService(apiClientOptions);

      await expect(() => service.delete({})).rejects.toThrow("The given parameter is not a valid UUID");
    });

    it("throws an API error if the API returns an error response", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${offlineItemId}`), () =>
        mockApiResponseError(500, "Something went wrong!"),
      );

      const service = new UnmarkOfflineItemApiService(apiClientOptions);

      await expect(() => service.delete(offlineItemId)).rejects.toThrow(PassboltApiFetchError);
    });

    it("throws a service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      const offlineItemId = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/${offlineItemId}`), () => {
        throw new Error("Service unavailable");
      });

      const service = new UnmarkOfflineItemApiService(apiClientOptions);

      await expect(() => service.delete(offlineItemId)).rejects.toThrow(PassboltServiceUnavailableError);
    });
  });
});
