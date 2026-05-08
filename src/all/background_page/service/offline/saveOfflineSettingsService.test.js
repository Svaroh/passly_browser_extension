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
import SaveOfflineSettingsService from "./saveOfflineSettingsService";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";

describe("SaveOfflineSettingsService", () => {
  let apiClientOptions;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::save", () => {
    it("successfully saves offline settings", async () => {
      expect.assertions(2);
      const apiResponse = defaultOfflineSettingsDto();
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponse(apiResponse));

      const service = new SaveOfflineSettingsService(apiClientOptions);
      const offlineSettings = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      const result = await service.save(offlineSettings);

      expect(result).toBeInstanceOf(OfflineSettingsEntity);
      expect(result).toEqual(new OfflineSettingsEntity(apiResponse));
    });

    it("throws a TypeError if the parameter is not an OfflineSettingsEntity", async () => {
      expect.assertions(1);
      const service = new SaveOfflineSettingsService(apiClientOptions);

      await expect(() => service.save({})).rejects.toThrow(TypeError);
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => {
        throw new Error("Service unavailable");
      });

      const service = new SaveOfflineSettingsService(apiClientOptions);
      const offlineSettings = new OfflineSettingsEntity(defaultOfflineSettingsDto());

      await expect(() => service.save(offlineSettings)).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponseError(500, "Something wrong happened!"));

      const service = new SaveOfflineSettingsService(apiClientOptions);
      const offlineSettings = new OfflineSettingsEntity(defaultOfflineSettingsDto());

      await expect(() => service.save(offlineSettings)).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
