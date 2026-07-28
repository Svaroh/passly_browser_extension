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
import DisableOfflineSettingsService from "./disableOfflineSettingsService";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import PassboltServiceUnavailableError from "passbolt-styleguide/src/shared/lib/Error/PassboltServiceUnavailableError";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";

describe("DisableOfflineSettingsService", () => {
  let apiClientOptions, account;

  beforeEach(async () => {
    enableFetchMocks();
    fetch.resetMocks();
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
  });

  describe("::disable", () => {
    it("successfully disables offline settings and clears the local storage", async () => {
      expect.assertions(2);
      const id = uuidv4();
      fetch.doMockOnceIf(new RegExp(`/offline/settings/${id}.json`), () => mockApiResponse({}));

      const service = new DisableOfflineSettingsService(account, apiClientOptions);
      // Seed a stale local storage to prove it gets cleared on disable.
      await service.offlineSettingsLocalStorage.setData(new OfflineSettingsEntity(defaultOfflineSettingsDto()));
      const result = await service.disable(id);

      expect(result.body).toStrictEqual({});
      const storageValue = await service.offlineSettingsLocalStorage.getData();
      expect(storageValue).toBeUndefined();
    });

    it("throws an error for invalid UUID", async () => {
      expect.assertions(1);
      const service = new DisableOfflineSettingsService(account, apiClientOptions);

      await expect(() => service.disable("invalid-uuid")).rejects.toThrow(
        Error("The given parameter is not a valid UUID"),
      );
    });

    it("throws service unavailable error if an error occurred but not from the API", async () => {
      expect.assertions(1);
      const id = uuidv4();
      fetch.doMockOnceIf(/offline\/settings/, () => {
        throw new Error("Service unavailable");
      });

      const service = new DisableOfflineSettingsService(account, apiClientOptions);

      await expect(() => service.disable(id)).rejects.toThrow(PassboltServiceUnavailableError);
    });

    it("throws API error if the API encountered an issue", async () => {
      expect.assertions(1);
      const id = uuidv4();
      fetch.doMockOnceIf(/offline\/settings/, () => mockApiResponseError(500, "Something wrong happened!"));

      const service = new DisableOfflineSettingsService(account, apiClientOptions);

      await expect(() => service.disable(id)).rejects.toThrow(PassboltApiFetchError);
    });
  });
});
