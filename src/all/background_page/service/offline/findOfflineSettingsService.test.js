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
import FindOfflineSettingsService from "./findOfflineSettingsService";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";

describe("FindOfflineSettingsService", () => {
  let apiClientOptions;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::get", () => {
    it("retrieves the offline settings entity when settings exist", async () => {
      expect.assertions(2);
      const apiResponse = defaultOfflineSettingsDto();
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponse(apiResponse));

      const service = new FindOfflineSettingsService(apiClientOptions);
      const result = await service.get();

      expect(result).toBeInstanceOf(OfflineSettingsEntity);
      expect(result.id).toBe(apiResponse.id);
    });

    it("returns null when offline settings are not defined", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponse({}));

      const service = new FindOfflineSettingsService(apiClientOptions);
      const result = await service.get();

      expect(result).toBeNull();
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => {
        throw new Error("Service unavailable");
      });

      const service = new FindOfflineSettingsService(apiClientOptions);

      await expect(() => service.get()).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      fetch.doMockOnceIf(/offline\/settings\.json/, () => mockApiResponseError(500, "Something wrong happened!"));

      const service = new FindOfflineSettingsService(apiClientOptions);

      await expect(() => service.get()).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
