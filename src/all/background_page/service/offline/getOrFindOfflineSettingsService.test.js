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

import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { offlinePluginEnabledOrganizationSettings } from "../../model/entity/organizationSettings/organizationSettingsEntity.test.data";
import GetOrFindOfflineSettingsService from "./getOrFindOfflineSettingsService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GetOrFindOfflineSettingsService", () => {
  let getOrFindOfflineSettingsService, account, apiClientOptions;

  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    getOrFindOfflineSettingsService = new GetOrFindOfflineSettingsService(account, apiClientOptions);
    await getOrFindOfflineSettingsService.offlineSettingsLocalStorage.flush();
  });

  describe("::getOrFind", () => {
    it("with empty storage, retrieves the offline settings from the API and stores them into the local storage.", async () => {
      expect.assertions(3);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      jest
        .spyOn(
          getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.findOfflineSettingsService
            .offlineSettingsApiService,
          "find",
        )
        .mockImplementation(() => ({ body: offlineSettingsDto }));
      jest
        .spyOn(
          getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.organisationSettingsModel
            .organizationSettingsService,
          "find",
        )
        .mockImplementation(() => offlinePluginEnabledOrganizationSettings());

      // Control initial storage value.
      const initialStorageValue = await getOrFindOfflineSettingsService.offlineSettingsLocalStorage.get();
      expect(initialStorageValue).toBeUndefined();

      const entity = await getOrFindOfflineSettingsService.getOrFind();

      expect(entity.toDto()).toEqual(offlineSettingsDto);
      const storageValue = await getOrFindOfflineSettingsService.offlineSettingsLocalStorage.get();
      expect(storageValue).toEqual(offlineSettingsDto);
    });

    it("with populated storage, retrieves the offline settings from the local storage.", async () => {
      expect.assertions(2);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      await getOrFindOfflineSettingsService.offlineSettingsLocalStorage.set(
        new OfflineSettingsEntity(offlineSettingsDto),
      );
      jest.spyOn(
        getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.findOfflineSettingsService
          .offlineSettingsApiService,
        "find",
      );

      const entity = await getOrFindOfflineSettingsService.getOrFind();

      expect(
        getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.findOfflineSettingsService
          .offlineSettingsApiService.find,
      ).not.toHaveBeenCalled();
      expect(entity.toDto()).toEqual(offlineSettingsDto);
    });

    it("with empty storage and no offline settings available from the API, returns null and leaves storage empty.", async () => {
      expect.assertions(3);
      jest
        .spyOn(
          getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.findOfflineSettingsService
            .offlineSettingsApiService,
          "find",
        )
        .mockImplementation(() => ({ body: {} }));
      jest
        .spyOn(
          getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.organisationSettingsModel
            .organizationSettingsService,
          "find",
        )
        .mockImplementation(() => offlinePluginEnabledOrganizationSettings());

      const entity = await getOrFindOfflineSettingsService.getOrFind();

      expect(entity).toBeNull();
      expect(
        getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService.findOfflineSettingsService
          .offlineSettingsApiService.find,
      ).toHaveBeenCalledTimes(1);
      const storageValue = await getOrFindOfflineSettingsService.offlineSettingsLocalStorage.get();
      expect(storageValue).toBeUndefined();
    });
  });
});
