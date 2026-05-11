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

import DeleteOfflineSettingsController from "./deleteOfflineSettingsController";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { v4 as uuidv4 } from "uuid";

describe("DeleteOfflineSettingsController", () => {
  let apiClientOptions, controller;

  beforeEach(() => {
    apiClientOptions = defaultApiClientOptions();
    controller = new DeleteOfflineSettingsController(null, null, apiClientOptions);
  });

  describe("::exec", () => {
    it("should delete offline settings", async () => {
      expect.assertions(2);
      const id = uuidv4();
      const expectedResult = { success: true };
      jest.spyOn(controller.disableOfflineSettingsService, "disable").mockResolvedValue(expectedResult);

      const result = await controller.exec(id);

      expect(result).toEqual(expectedResult);
      expect(controller.disableOfflineSettingsService.disable).toHaveBeenCalledWith(id);
    });

    it("should throw an error if the given id is not a valid uuid", async () => {
      expect.assertions(2);
      jest.spyOn(controller.disableOfflineSettingsService, "disable");

      await expect(controller.exec("not-a-uuid")).rejects.toThrow();
      expect(controller.disableOfflineSettingsService.disable).not.toHaveBeenCalled();
    });

    it("should handle errors when deleting offline settings", async () => {
      expect.assertions(2);
      const error = new Error("Failed to delete offline settings");
      const id = uuidv4();
      jest.spyOn(controller.disableOfflineSettingsService, "disable").mockRejectedValue(error);

      await expect(controller.exec(id)).rejects.toThrow(error.message);
      expect(controller.disableOfflineSettingsService.disable).toHaveBeenCalledWith(id);
    });
  });
});
