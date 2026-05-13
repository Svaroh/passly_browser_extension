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

import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { v4 as uuidv4 } from "uuid";
import MarkItemOfflineUnavailableController from "./markItemOfflineUnavailableController";

describe("MarkResourceOfflineAvailableController", () => {
  let apiClientOptions, controller;

  beforeEach(() => {
    apiClientOptions = defaultApiClientOptions();
    controller = new MarkItemOfflineUnavailableController(null, null, apiClientOptions);
  });

  describe("::exec", () => {
    it("should mark the given item unavailable offline onto the API through the dedicated service", async () => {
      expect.assertions(3);
      const offlineItemId = uuidv4();
      jest.spyOn(controller.unmarkOfflineItemService, "delete").mockResolvedValue(null);

      const result = await controller.exec(offlineItemId);

      expect(result).toEqual(null);
      expect(controller.unmarkOfflineItemService.delete).toHaveBeenCalledTimes(1);
      expect(controller.unmarkOfflineItemService.delete).toHaveBeenCalledWith(offlineItemId);
    });

    it("should throw an error if the offline item id is not valid", async () => {
      expect.assertions(2);
      jest.spyOn(controller.unmarkOfflineItemService, "delete");

      await expect(controller.exec("not a uuid")).rejects.toThrow("The given parameter is not a valid UUID");
      expect(controller.unmarkOfflineItemService.delete).not.toHaveBeenCalled();
    });

    it("should not catch errors and let them be thrown if something wrong happened", async () => {
      expect.assertions(1);
      const expectedError = new Error("Something went wrong!");
      jest.spyOn(controller.unmarkOfflineItemService, "delete").mockRejectedValue(expectedError);

      await expect(controller.exec(uuidv4())).rejects.toThrow(expectedError.message);
    });
  });
});
