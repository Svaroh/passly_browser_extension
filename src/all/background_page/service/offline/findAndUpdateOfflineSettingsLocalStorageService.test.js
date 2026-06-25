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

import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import {
  defaultCeSiteSettings,
  offlinePluginEnabledSiteSettings,
} from "../../model/entity/siteSettings/siteSettingsEntity.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import FindAndUpdateOfflineSettingsLocalStorageService from "./findAndUpdateOfflineSettingsLocalStorageService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FindAndUpdateOfflineSettingsLocalStorageService", () => {
  let service, account, apiClientOptions;

  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    service = new FindAndUpdateOfflineSettingsLocalStorageService(account, apiClientOptions);
    // flush account related storage before each.
    await service.offlineSettingsLocalStorage.flush();
  });

  describe("::findAndUpdate", () => {
    it("retrieves the offline settings from the API and stores them into the local storage when the plugin is enabled and the user is allowed.", async () => {
      expect.assertions(3);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      jest
        .spyOn(service.findOfflineSettingsService.offlineSettingsApiService, "find")
        .mockImplementation(() => ({ body: offlineSettingsDto }));
      jest
        .spyOn(service.organisationSettingsModel.organizationSettingsService, "find")
        .mockImplementation(() => offlinePluginEnabledSiteSettings());

      const entity = await service.findAndUpdate();

      expect(entity).toBeInstanceOf(OfflineSettingsEntity);
      expect(entity.toDto()).toEqual(offlineSettingsDto);
      const storageValue = await service.offlineSettingsLocalStorage.get();
      expect(storageValue).toEqual(offlineSettingsDto);
    });

    it("returns null and does not call the API when the offline plugin is not enabled.", async () => {
      expect.assertions(3);
      jest.spyOn(service.findOfflineSettingsService.offlineSettingsApiService, "find");
      jest
        .spyOn(service.organisationSettingsModel.organizationSettingsService, "find")
        .mockImplementation(() => defaultCeSiteSettings());

      const entity = await service.findAndUpdate();

      expect(entity).toBeNull();
      expect(service.findOfflineSettingsService.offlineSettingsApiService.find).not.toHaveBeenCalled();
      const storageValue = await service.offlineSettingsLocalStorage.get();
      expect(storageValue).toBeUndefined();
    });

    it("returns null and does not update the local storage when the user is not allowed (API returns empty body).", async () => {
      expect.assertions(2);
      jest
        .spyOn(service.findOfflineSettingsService.offlineSettingsApiService, "find")
        .mockImplementation(() => ({ body: {} }));
      jest
        .spyOn(service.organisationSettingsModel.organizationSettingsService, "find")
        .mockImplementation(() => offlinePluginEnabledSiteSettings());

      const entity = await service.findAndUpdate();

      expect(entity).toBeNull();
      const storageValue = await service.offlineSettingsLocalStorage.get();
      expect(storageValue).toBeUndefined();
    });

    it("overrides local storage with a second update call.", async () => {
      expect.assertions(2);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      jest
        .spyOn(service.findOfflineSettingsService.offlineSettingsApiService, "find")
        .mockImplementation(() => ({ body: offlineSettingsDto }));
      jest
        .spyOn(service.organisationSettingsModel.organizationSettingsService, "find")
        .mockImplementation(() => offlinePluginEnabledSiteSettings());
      await service.offlineSettingsLocalStorage.set(new OfflineSettingsEntity(defaultOfflineSettingsDto()));

      const entity = await service.findAndUpdate();

      expect(entity.toDto()).toEqual(offlineSettingsDto);
      const storageValue = await service.offlineSettingsLocalStorage.get();
      expect(storageValue).toEqual(offlineSettingsDto);
    });

    it("waits any on-going call to the update and returns the result of the local storage.", async () => {
      expect.assertions(4);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      let resolve;
      const promise = new Promise((_resolve) => (resolve = _resolve));
      jest
        .spyOn(service.findOfflineSettingsService.offlineSettingsApiService, "find")
        .mockImplementation(() => promise);
      jest
        .spyOn(service.organisationSettingsModel.organizationSettingsService, "find")
        .mockImplementation(() => offlinePluginEnabledSiteSettings());
      await service.offlineSettingsLocalStorage.set(new OfflineSettingsEntity(defaultOfflineSettingsDto()));

      const promiseFirstCall = service.findAndUpdate();
      const promiseSecondCall = service.findAndUpdate();
      resolve({ body: offlineSettingsDto });
      const resultFirstCall = await promiseFirstCall;
      const resultSecondCall = await promiseSecondCall;

      expect(service.findOfflineSettingsService.offlineSettingsApiService.find).toHaveBeenCalledTimes(1);
      expect(resultFirstCall.toDto()).toEqual(offlineSettingsDto);
      expect(resultSecondCall.toDto()).toEqual(offlineSettingsDto);
      const storageValue = await service.offlineSettingsLocalStorage.get();
      expect(storageValue).toEqual(offlineSettingsDto);
    });
  });
});
