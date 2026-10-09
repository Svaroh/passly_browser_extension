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

import FindOfflineSettingsController from "./findOfflineSettingsController";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";

describe("FindOfflineSettingsController", () => {
  let apiClientOptions, account, controller;

  beforeEach(() => {
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
    controller = new FindOfflineSettingsController(null, null, apiClientOptions, account);
  });

  describe("::exec", () => {
    it("should find and update offline settings", async () => {
      expect.assertions(2);
      const offlineSettingsEntity = new OfflineSettingsEntity(defaultOfflineSettingsDto());
      jest
        .spyOn(controller.findAndUpdateOfflineSettingsLocalStorageService, "findAndUpdate")
        .mockResolvedValue(offlineSettingsEntity);

      const result = await controller.exec();

      expect(result).toEqual(offlineSettingsEntity);
      expect(controller.findAndUpdateOfflineSettingsLocalStorageService.findAndUpdate).toHaveBeenCalled();
    });

    it("should return null when no offline settings are found", async () => {
      expect.assertions(2);
      jest.spyOn(controller.findAndUpdateOfflineSettingsLocalStorageService, "findAndUpdate").mockResolvedValue(null);

      const result = await controller.exec();

      expect(result).toBeNull();
      expect(controller.findAndUpdateOfflineSettingsLocalStorageService.findAndUpdate).toHaveBeenCalled();
    });

    it("should handle errors when finding offline settings", async () => {
      expect.assertions(2);
      const error = new Error("Failed to find offline settings");
      jest.spyOn(controller.findAndUpdateOfflineSettingsLocalStorageService, "findAndUpdate").mockRejectedValue(error);

      await expect(controller.exec()).rejects.toThrow(error.message);
      expect(controller.findAndUpdateOfflineSettingsLocalStorageService.findAndUpdate).toHaveBeenCalled();
    });
  });
});
