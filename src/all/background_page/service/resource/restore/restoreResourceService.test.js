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
 * @since         6.0.1
 */

import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import AccountEntity from "../../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../../model/entity/account/accountEntity.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import RestoreResourceService from "./restoreResourceService";
import ResourceLocalStorage from "../../local_storage/resourceLocalStorage";
import ProgressService from "../../progress/progressService";

jest.mock("../../../service/progress/progressService");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RestoreResourceService", () => {
  let restoreResourceService, worker;
  const account = new AccountEntity(defaultAccountDto());
  const apiClientOptions = defaultApiClientOptions();

  beforeEach(async () => {
    worker = {
      port: {
        emit: jest.fn(),
      },
    };
    restoreResourceService = new RestoreResourceService(account, apiClientOptions, new ProgressService(worker, ""));
    jest.spyOn(ResourceLocalStorage, "addOrReplaceResourcesCollection");
  });

  describe("RestoreResourceService::restoreResources", () => {
    it("Should restore the resources and call local storage update", async () => {
      expect.assertions(6);

      const resourceDto1 = defaultResourceDto();
      const resourceDto2 = defaultResourceDto();
      const resourceDto3 = defaultResourceDto();
      jest
        .spyOn(restoreResourceService.resourceService, "restore")
        .mockImplementation((resourceId) =>
          [resourceDto1, resourceDto2, resourceDto3].find((r) => r.id === resourceId),
        );

      const restoredResources = await restoreResourceService.restoreResources([
        resourceDto1.id,
        resourceDto2.id,
        resourceDto3.id,
      ]);

      expect(restoreResourceService.resourceService.restore).toHaveBeenCalledTimes(3);
      expect(restoreResourceService.resourceService.restore).toHaveBeenCalledWith(resourceDto1.id);
      expect(restoreResourceService.resourceService.restore).toHaveBeenCalledWith(resourceDto2.id);
      expect(restoreResourceService.resourceService.restore).toHaveBeenCalledWith(resourceDto3.id);
      expect(ResourceLocalStorage.addOrReplaceResourcesCollection.mock.calls[0][0].ids).toStrictEqual([
        resourceDto1.id,
        resourceDto2.id,
        resourceDto3.id,
      ]);
      expect(restoredResources).toStrictEqual([resourceDto1, resourceDto2, resourceDto3]);
    });

    it("Should call progress service during the different steps of restoration", async () => {
      expect.assertions(3);

      const resourceDto1 = defaultResourceDto();
      const resourceDto2 = defaultResourceDto();
      const resourceDto3 = defaultResourceDto();
      jest
        .spyOn(restoreResourceService.resourceService, "restore")
        .mockImplementation((resourceId) =>
          [resourceDto1, resourceDto2, resourceDto3].find((r) => r.id === resourceId),
        );

      await restoreResourceService.restoreResources([resourceDto1.id, resourceDto2.id, resourceDto3.id]);

      expect(restoreResourceService.progressService.finishStep).toHaveBeenCalledTimes(2);
      expect(restoreResourceService.progressService.finishStep).toHaveBeenCalledWith("Restoring Resource(s)", true);
      expect(restoreResourceService.progressService.finishStep).toHaveBeenCalledWith(
        "Updating resources local storage",
        true,
      );
    });
  });
});
