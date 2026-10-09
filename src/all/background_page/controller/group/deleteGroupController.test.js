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
import DeleteGroupController from "./deleteGroupController";
import GroupDeleteTransferEntity from "../../model/entity/group/transfer/groupDeleteTransferEntity";
import { defaultGroupTransferDto } from "passbolt-styleguide/src/shared/models/entity/group/groupTransfer.test.data";
import EntityValidationError from "passbolt-styleguide/src/shared/models/entity/abstract/entityValidationError";
import { v4 as uuidv4 } from "uuid";

describe("DeleteGroupController", () => {
  let controller;
  const account = new AccountEntity(defaultAccountDto());

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DeleteGroupController(null, null, defaultApiClientOptions(), account);
    jest.spyOn(controller.deleteGroupService, "delete").mockResolvedValue();
  });

  describe("::exec", () => {
    it("deletes a group without transfer", async () => {
      expect.assertions(1);

      const groupId = uuidv4();

      await controller.exec(groupId);

      expect(controller.deleteGroupService.delete).toHaveBeenCalledWith(groupId, null);
    });

    it("deletes a group with transfer", async () => {
      expect.assertions(1);

      const groupId = uuidv4();
      const transferDto = defaultGroupTransferDto();

      await controller.exec(groupId, transferDto);

      expect(controller.deleteGroupService.delete).toHaveBeenCalledWith(
        groupId,
        new GroupDeleteTransferEntity(transferDto),
      );
    });

    it("throws if the transfer dto is invalid", async () => {
      expect.assertions(2);

      await expect(controller.exec(uuidv4(), { owners: 42 })).rejects.toThrow(EntityValidationError);
      expect(controller.deleteGroupService.delete).not.toHaveBeenCalled();
    });

    it("rethrows the service error", async () => {
      expect.assertions(1);

      const error = new Error("Something went wrong!");
      controller.deleteGroupService.delete.mockRejectedValue(error);

      await expect(controller.exec(uuidv4())).rejects.toThrow(error);
    });
  });
});
