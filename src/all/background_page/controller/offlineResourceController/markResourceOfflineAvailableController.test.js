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
import MarkResourceOfflineAvailableController from "./markResourceOfflineAvailableController";
import { v4 as uuidv4 } from "uuid";
import { defaultOfflineItemDto } from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity.test.data";
import OfflineItemEntity from "passbolt-styleguide/src/shared/models/entity/offline/offlineItemEntity";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";

describe("MarkResourceOfflineAvailableController", () => {
  let apiClientOptions, account, controller;

  beforeEach(() => {
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());
    controller = new MarkResourceOfflineAvailableController(null, null, apiClientOptions, account);
  });

  describe("::exec", () => {
    it("should mark the given resource available offline onto the API through the dedicated service", async () => {
      expect.assertions(3);
      const resourceId = uuidv4();
      const offlineItemEntity = new OfflineItemEntity(defaultOfflineItemDto({ foreign_key: resourceId }));
      jest.spyOn(controller.markOfflineResourceService, "create").mockResolvedValue(offlineItemEntity);

      const result = await controller.exec(resourceId);

      expect(result).toEqual(offlineItemEntity);
      expect(controller.markOfflineResourceService.create).toHaveBeenCalledTimes(1);
      expect(controller.markOfflineResourceService.create).toHaveBeenCalledWith(resourceId);
    });

    it("should throw an error if the resource id is not valid", async () => {
      expect.assertions(2);
      jest.spyOn(controller.markOfflineResourceService, "create");

      await expect(controller.exec("not a uuid")).rejects.toThrow("The given parameter is not a valid UUID");
      expect(controller.markOfflineResourceService.create).not.toHaveBeenCalled();
    });

    it("should not catch errors and let them be thrown if something wrong happened", async () => {
      expect.assertions(1);
      const expectedError = new Error("Something went wrong!");
      jest.spyOn(controller.markOfflineResourceService, "create").mockRejectedValue(expectedError);

      await expect(controller.exec(uuidv4())).rejects.toThrow(expectedError.message);
    });
  });
});
