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

import DeleteFolderController from "./deleteFolderController";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { v4 as uuidv4 } from "uuid";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DeleteFolderController", () => {
  let controller, worker;
  const requestId = "request-id";

  beforeEach(() => {
    const account = new AccountEntity(defaultAccountDto());
    const apiClientOptions = defaultApiClientOptions();
    worker = { port: { emit: jest.fn() } };
    controller = new DeleteFolderController(worker, requestId, apiClientOptions, account);
  });

  describe("::exec", () => {
    it("deletes the folder and returns its id", async () => {
      expect.assertions(2);
      const folderId = uuidv4();
      jest.spyOn(controller.deleteFolderService, "delete").mockResolvedValue();

      const result = await controller.exec(folderId, true);

      expect(controller.deleteFolderService.delete).toHaveBeenCalledWith(folderId, true);
      expect(result).toEqual(folderId);
    });

    it("defaults cascade to false", async () => {
      expect.assertions(1);
      const folderId = uuidv4();
      jest.spyOn(controller.deleteFolderService, "delete").mockResolvedValue();

      await controller.exec(folderId);

      expect(controller.deleteFolderService.delete).toHaveBeenCalledWith(folderId, false);
    });
  });

  describe("::_exec", () => {
    it("emits SUCCESS with the deleted folder id", async () => {
      expect.assertions(1);
      const folderId = uuidv4();
      jest.spyOn(controller.deleteFolderService, "delete").mockResolvedValue();

      await controller._exec(folderId, false);

      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "SUCCESS", folderId);
    });

    it("emits ERROR with the original error if the deletion fails", async () => {
      expect.assertions(1);
      const error = new Error("delete failed");
      jest.spyOn(controller.deleteFolderService, "delete").mockRejectedValue(error);
      jest.spyOn(console, "error").mockImplementation(() => {});

      await controller._exec(uuidv4(), false);

      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "ERROR", error);
    });
  });
});
