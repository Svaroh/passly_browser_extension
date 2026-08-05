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

import GetOrFindOfflineSettingsController from "./getOrFindOfflineSettingsController";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { offlinePluginEnabledSiteSettings } from "../../model/entity/siteSettings/siteSettingsEntity.test.data";
import { enableFetchMocks } from "jest-fetch-mock";
import SiteSettingsEntity from "../../model/entity/siteSettings/siteSettingsEntity";
import UserActiveSessionEntity from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity";
import { defaultUserActiveSessionDto } from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity.test.data";

beforeEach(() => {
  enableFetchMocks();
  jest.clearAllMocks();
});

describe("GetOrFindOfflineSettingsController", () => {
  let apiClientOptions, account, controller;

  beforeEach(async () => {
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
    controller = new GetOrFindOfflineSettingsController(null, null, apiClientOptions, account);
    await controller.getOrFindOfflineSettingsService.offlineSettingsLocalStorage.flush();
    jest
      .spyOn(controller.getOrFindOfflineSettingsService.getOrFindActiveSessionService, "getOrFind")
      .mockImplementation(() => new UserActiveSessionEntity(defaultUserActiveSessionDto()));
  });

  describe("::exec", () => {
    it("with empty storage, retrieves the offline settings from the API and stores them into the local storage.", async () => {
      expect.assertions(3);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      jest
        .spyOn(
          controller.getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService
            .findOfflineSettingsService.offlineSettingsApiService,
          "find",
        )
        .mockImplementation(() => ({ body: offlineSettingsDto }));
      jest
        .spyOn(
          controller.getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService
            .getOrFindSiteSettingsService,
          "getOrFind",
        )
        .mockImplementation(() => new SiteSettingsEntity(offlinePluginEnabledSiteSettings()));

      const result = await controller.exec();

      expect(result).toBeInstanceOf(OfflineSettingsEntity);
      expect(result.toDto()).toEqual(offlineSettingsDto);
      const storageValue = await controller.getOrFindOfflineSettingsService.offlineSettingsLocalStorage.getData();
      expect(storageValue).toEqual(offlineSettingsDto);
    });

    it("with populated storage, retrieves the offline settings from the local storage.", async () => {
      expect.assertions(2);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      await controller.getOrFindOfflineSettingsService.offlineSettingsLocalStorage.setData(
        new OfflineSettingsEntity(offlineSettingsDto),
      );
      jest.spyOn(
        controller.getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService
          .findOfflineSettingsService.offlineSettingsApiService,
        "find",
      );

      const result = await controller.exec();

      expect(result.toDto()).toEqual(offlineSettingsDto);
      expect(
        controller.getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService
          .findOfflineSettingsService.offlineSettingsApiService.find,
      ).not.toHaveBeenCalled();
    });

    it("with empty storage and no offline settings available from the API, returns null.", async () => {
      expect.assertions(2);
      jest
        .spyOn(
          controller.getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService
            .findOfflineSettingsService.offlineSettingsApiService,
          "find",
        )
        .mockImplementation(() => ({ body: {} }));
      jest
        .spyOn(
          controller.getOrFindOfflineSettingsService.findAndUpdateOfflineSettingsLocalStorageService
            .getOrFindSiteSettingsService,
          "getOrFind",
        )
        .mockImplementation(() => new SiteSettingsEntity(offlinePluginEnabledSiteSettings()));

      const result = await controller.exec();

      expect(result).toBeNull();
      const storageValue = await controller.getOrFindOfflineSettingsService.offlineSettingsLocalStorage.getData();
      expect(storageValue).toBeUndefined();
    });

    it("should handle errors when retrieving offline settings.", async () => {
      expect.assertions(1);
      const error = new Error("Failed to retrieve offline settings");
      jest.spyOn(controller.getOrFindOfflineSettingsService, "getOrFind").mockRejectedValue(error);

      await expect(controller.exec()).rejects.toThrow(error.message);
    });
  });
});
