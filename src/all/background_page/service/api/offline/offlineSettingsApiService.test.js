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
import { v4 as uuidv4 } from "uuid";
import { mockApiResponse, mockApiResponseError } from "passbolt-styleguide/test/mocks/mockApiResponse";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import PassboltResponseEntity from "passbolt-styleguide/src/shared/models/entity/apiService/PassboltResponseEntity";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import OfflineSettingsApiService from "./offlineSettingsApiService";

describe("OfflineSettingsApiService", () => {
  let apiClientOptions;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::find", () => {
    it("retrieves the offline settings from the API", async () => {
      expect.assertions(2);
      const expectedDto = defaultOfflineSettingsDto();
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponse(expectedDto));

      const service = new OfflineSettingsApiService(apiClientOptions);
      const result = await service.find();

      expect(result).toBeInstanceOf(PassboltResponseEntity);
      expect(result.body).toStrictEqual(expectedDto);
    });

    it("throws an API error if the API returns an error response", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponseError(500, "Something went wrong!"));

      const service = new OfflineSettingsApiService(apiClientOptions);

      await expect(() => service.find()).rejects.toThrow(PassboltApiFetchError);
    });

    it("throws a service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => {
        throw new Error("Service unavailable");
      });

      const service = new OfflineSettingsApiService(apiClientOptions);

      await expect(() => service.find()).rejects.toThrow(PassboltServiceUnavailableError);
    });
  });

  describe("::save", () => {
    it("saves the offline settings on the API", async () => {
      expect.assertions(2);
      const offlineSettings = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponse(offlineSettings.toDto()));

      const service = new OfflineSettingsApiService(apiClientOptions);
      const result = await service.save(offlineSettings);

      expect(result).toBeInstanceOf(PassboltResponseEntity);
      expect(result.body).toStrictEqual(offlineSettings.toDto());
    });

    it("throws a TypeError if the parameter is not an OfflineSettingsEntity", async () => {
      expect.assertions(1);
      const service = new OfflineSettingsApiService(apiClientOptions);

      await expect(() => service.save({})).rejects.toThrow(TypeError);
    });

    it("throws an API error if the API returns an error response", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponseError(500, "Something went wrong!"));

      const service = new OfflineSettingsApiService(apiClientOptions);
      const offlineSettings = new OfflineSettingsEntity(defaultOfflineSettingsDto());

      await expect(() => service.save(offlineSettings)).rejects.toThrow(PassboltApiFetchError);
    });

    it("throws a service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => {
        throw new Error("Service unavailable");
      });

      const service = new OfflineSettingsApiService(apiClientOptions);
      const offlineSettings = new OfflineSettingsEntity(defaultOfflineSettingsDto());

      await expect(() => service.save(offlineSettings)).rejects.toThrow(PassboltServiceUnavailableError);
    });
  });

  describe("::delete", () => {
    it("deletes the offline settings on the API", async () => {
      expect.assertions(2);
      const id = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/settings/${id}.json`), () => mockApiResponse({}));

      const service = new OfflineSettingsApiService(apiClientOptions);
      const result = await service.delete(id);

      expect(result).toBeInstanceOf(PassboltResponseEntity);
      expect(result.body).toStrictEqual({});
    });

    it("throws an error if the id is invalid", async () => {
      expect.assertions(1);
      const service = new OfflineSettingsApiService(apiClientOptions);

      await expect(() => service.delete("invalid-uuid")).rejects.toThrow(TypeError);
    });

    it("throws an API error if the API returns an error response", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings/, () => mockApiResponseError(500, "Something went wrong!"));

      const service = new OfflineSettingsApiService(apiClientOptions);

      await expect(() => service.delete(uuidv4())).rejects.toThrow(PassboltApiFetchError);
    });

    it("throws a service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings/, () => {
        throw new Error("Service unavailable");
      });

      const service = new OfflineSettingsApiService(apiClientOptions);

      await expect(() => service.delete(uuidv4())).rejects.toThrow(PassboltServiceUnavailableError);
    });
  });
});
