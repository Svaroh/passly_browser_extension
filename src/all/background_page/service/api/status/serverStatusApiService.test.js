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
import { enableFetchMocks } from "jest-fetch-mock";
import { mockApiResponse, mockApiResponseError } from "passbolt-styleguide/test/mocks/mockApiResponse";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import ServerStatusApiService from "./serverStatusApiService";

describe("ServerStatusApiService", () => {
  let apiClientOptions;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::find", () => {
    it("retrieves the server status from the API", async () => {
      expect.assertions(2);
      fetch.doMockOnceIf(/healthcheck\/status\.json/, () => mockApiResponse("Ok"));

      const service = new ServerStatusApiService(apiClientOptions);
      const result = await service.find();

      expect(result).toBeInstanceOf(PassboltResponseEntity);
      expect(result.body).toStrictEqual("Ok");
    });

    it("throws an API error if the API returns an error response", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/healthcheck\/status\.json/, () => mockApiResponseError(500, "Something went wrong!"));

      const service = new ServerStatusApiService(apiClientOptions);

      await expect(() => service.find()).rejects.toThrow(PassboltApiFetchError);
    });

    it("throws a service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/healthcheck\/status\.json/, () => {
        throw new Error("Service unavailable");
      });

      const service = new ServerStatusApiService(apiClientOptions);

      await expect(() => service.find()).rejects.toThrow(PassboltServiceUnavailableError);
    });
  });
});
