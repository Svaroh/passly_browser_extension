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
 * @since         5.16.0
 */

import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import DeleteDryRunGroupController from "./deleteDryRunGroupController";
import DeleteDryRunError from "../../error/deleteDryRunError";
import { v4 as uuidv4 } from "uuid";

describe("DeleteDryRunGroupController", () => {
  let controller;
  const account = new AccountEntity(defaultAccountDto());

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DeleteDryRunGroupController(null, null, defaultApiClientOptions(), account);
    jest.spyOn(controller.deleteGroupService, "deleteDryRun").mockResolvedValue();
  });

  describe("::exec", () => {
    it("delegates the dry run to DeleteGroupService with the group id", async () => {
      expect.assertions(2);
      const groupId = uuidv4();
      await controller.exec(groupId);
      expect(controller.deleteGroupService.deleteDryRun).toHaveBeenCalledTimes(1);
      expect(controller.deleteGroupService.deleteDryRun).toHaveBeenCalledWith(groupId);
    });

    it("rethrows the service error untouched", async () => {
      expect.assertions(1);
      const error = new DeleteDryRunError("Need transfer", { resources: { sole_owner: [defaultResourceDto()] } });
      controller.deleteGroupService.deleteDryRun.mockRejectedValue(error);
      await expect(controller.exec(uuidv4())).rejects.toBe(error);
    });
  });
});
