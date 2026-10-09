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

import SaveOfflineSettingsController from "./saveOfflineSettingsController";
import OfflineSettingsEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultOfflineSettingsDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineSettingsEntity.test.data";
import EntityValidationError from "passbolt-styleguide/src/shared/models/entity/abstract/entityValidationError";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";

describe("SaveOfflineSettingsController", () => {
  let apiClientOptions, account, controller;

  beforeEach(() => {
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
    controller = new SaveOfflineSettingsController(null, null, apiClientOptions, account);
  });

  describe("::exec", () => {
    it("should save the given offline settings onto the API through the dedicated service", async () => {
      expect.assertions(3);
      const offlineSettingsDto = defaultOfflineSettingsDto();
      const offlineSettingsEntity = new OfflineSettingsEntity(offlineSettingsDto);
      jest.spyOn(controller.saveOfflineSettingsService, "save").mockResolvedValue(offlineSettingsEntity);

      const result = await controller.exec(offlineSettingsDto);

      expect(result).toEqual(offlineSettingsEntity);
      expect(controller.saveOfflineSettingsService.save).toHaveBeenCalledTimes(1);
      expect(controller.saveOfflineSettingsService.save).toHaveBeenCalledWith(offlineSettingsEntity);
    });

    it("should throw an error if the entity does not validate", async () => {
      expect.assertions(2);
      jest.spyOn(controller.saveOfflineSettingsService, "save");
      const invalidDto = defaultOfflineSettingsDto({ id: 42 });

      await expect(controller.exec(invalidDto)).rejects.toThrow(EntityValidationError);
      expect(controller.saveOfflineSettingsService.save).not.toHaveBeenCalled();
    });

    it("should not catch errors and let them be thrown if something wrong happened", async () => {
      expect.assertions(1);
      const expectedError = new Error("Something went wrong!");
      jest.spyOn(controller.saveOfflineSettingsService, "save").mockRejectedValue(expectedError);

      await expect(controller.exec(defaultOfflineSettingsDto())).rejects.toThrow(expectedError.message);
    });
  });
});
