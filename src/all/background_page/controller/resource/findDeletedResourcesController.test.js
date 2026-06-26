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
 * @since         6.0.3
 */

import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import FindDeletedResourcesController from "./findDeletedResourcesController";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import ResourceLocalStorage from "../../service/local_storage/resourceLocalStorage";

describe("FindDeletedResourcesController", () => {
  let controller, worker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = {
      port: {
        emit: jest.fn(),
      },
    };
    const account = new AccountEntity(defaultAccountDto());
    controller = new FindDeletedResourcesController(worker, null, defaultApiClientOptions(), account);
  });

  describe("FindDeletedResourcesController::_exec", () => {
    it("Should emit a success message with deleted resources", async () => {
      expect.assertions(1);

      const deletedResources = [defaultResourceDto({ deleted: true }), defaultResourceDto({ deleted: true })];
      const deletedResourcesCollection = new ResourcesCollection(deletedResources);
      jest
        .spyOn(controller.findAndUpdateResourcesLocalStorage, "findAndUpdateDeleted")
        .mockResolvedValue(deletedResourcesCollection);

      await controller._exec();

      expect(controller.worker.port.emit).toHaveBeenCalledWith(
        null,
        "SUCCESS",
        deletedResourcesCollection.items.map((resource) => resource.toDto(ResourceLocalStorage.DEFAULT_CONTAIN)),
      );
    });

    it("Should emit an error message whenever an error occurred", async () => {
      expect.assertions(1);

      const error = new Error();
      jest.spyOn(controller.findAndUpdateResourcesLocalStorage, "findAndUpdateDeleted").mockRejectedValue(error);

      await controller._exec();

      expect(controller.worker.port.emit).toHaveBeenCalledWith(null, "ERROR", error);
    });
  });
});
