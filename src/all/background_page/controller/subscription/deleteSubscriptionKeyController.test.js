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

import DeleteSubscriptionKeyController from "./deleteSubscriptionKeyController";

describe("DeleteSubscriptionKeyController", () => {
  describe("::exec", () => {
    it("should delete the subscription key", async () => {
      expect.assertions(2);

      const controller = new DeleteSubscriptionKeyController(null, null, defaultApiClientOptions());
      jest.spyOn(controller.deleteSubscriptionService, "delete").mockResolvedValue(undefined);

      await expect(controller.exec()).resolves.toBeUndefined();
      expect(controller.deleteSubscriptionService.delete).toHaveBeenCalledTimes(1);
    });

    it("should not catch errors", async () => {
      expect.assertions(1);

      const expectedError = new Error("Something went wrong!");
      const controller = new DeleteSubscriptionKeyController(null, null, defaultApiClientOptions());
      jest.spyOn(controller.deleteSubscriptionService, "delete").mockRejectedValue(expectedError);

      await expect(controller.exec()).rejects.toStrictEqual(expectedError);
    });
  });
});
