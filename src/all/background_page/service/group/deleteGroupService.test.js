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
import DeleteGroupService from "./deleteGroupService";
import { v4 as uuidv4 } from "uuid";
import DeleteDryRunError from "../../error/deleteDryRunError";
import PassboltApiFetchError from "passbolt-styleguide/src/shared/lib/Error/PassboltApiFetchError";
import GroupDeleteTransferEntity from "../../model/entity/group/transfer/groupDeleteTransferEntity";
import { defaultGroupTransferDto } from "passbolt-styleguide/src/shared/models/entity/group/groupTransfer.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";

describe("DeleteGroupService", () => {
  let deleteGroupService;
  const account = new AccountEntity(defaultAccountDto());

  beforeEach(() => {
    jest.clearAllMocks();
    deleteGroupService = new DeleteGroupService(defaultApiClientOptions(), account);
    jest.spyOn(deleteGroupService.groupLocalStorage, "delete").mockResolvedValue();
  });

  describe("::delete", () => {
    it("deletes a group with no transfer", async () => {
      expect.assertions(2);

      const groupId = uuidv4();
      jest.spyOn(deleteGroupService.groupApiService, "delete").mockResolvedValue();

      await deleteGroupService.delete(groupId, null);

      expect(deleteGroupService.groupApiService.delete).toHaveBeenCalledWith(groupId, {});
      expect(deleteGroupService.groupLocalStorage.delete).toHaveBeenCalledWith(groupId);
    });

    it("deletes a group with transfer", async () => {
      expect.assertions(2);

      const groupId = uuidv4();
      const dto = defaultGroupTransferDto();
      const transfer = new GroupDeleteTransferEntity(dto);
      jest.spyOn(deleteGroupService.groupApiService, "delete").mockResolvedValue();

      await deleteGroupService.delete(groupId, transfer);

      expect(deleteGroupService.groupApiService.delete).toHaveBeenCalledWith(groupId, dto);
      expect(deleteGroupService.groupLocalStorage.delete).toHaveBeenCalledWith(groupId);
    });

    it("throws a DeleteDryRunError if ownership needs to be transferred", async () => {
      expect.assertions(3);

      const groupId = uuidv4();
      const resourceDto = defaultResourceDto();
      const error = {
        code: 400,
        body: {
          errors: {
            resources: {
              sole_owner: [resourceDto],
            },
          },
        },
      };
      jest
        .spyOn(deleteGroupService.groupApiService, "delete")
        .mockRejectedValue(new PassboltApiFetchError("Error", error));

      const promise = deleteGroupService.delete(groupId, null);

      await expect(promise).rejects.toThrow(DeleteDryRunError);
      const thrownError = await promise.catch((e) => e);
      expect(thrownError.errors.resources.sole_owner.items.map((r) => r.id)).toEqual([resourceDto.id]);
      expect(deleteGroupService.groupLocalStorage.delete).not.toHaveBeenCalled();
    });

    it("rethrows any unexpected error", async () => {
      expect.assertions(2);

      const groupId = uuidv4();
      jest
        .spyOn(deleteGroupService.groupApiService, "delete")
        .mockRejectedValue(new PassboltApiFetchError("Error", { code: 404 }));

      await expect(deleteGroupService.delete(groupId, null)).rejects.toThrow(PassboltApiFetchError);
      expect(deleteGroupService.groupLocalStorage.delete).not.toHaveBeenCalled();
    });

    it("throws if the group id is not a uuid", async () => {
      expect.assertions(1);

      await expect(deleteGroupService.delete({})).rejects.toThrow('The parameter "groupId" should be a UUID');
    });

    it("throws if the transfer is not a GroupDeleteTransferEntity", async () => {
      expect.assertions(1);

      await expect(deleteGroupService.delete(uuidv4(), {})).rejects.toThrow(
        'The parameter "transfer" should be a GroupDeleteTransferEntity',
      );
    });
  });
});
