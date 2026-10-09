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

import { v4 as uuidv4 } from "uuid";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultFolderDto } from "passbolt-styleguide/src/shared/models/entity/folder/folderEntity.test.data";
import UpdateFolderController from "./updateFolderController";
import FolderEntity from "../../model/entity/folder/folderEntity";

describe("UpdateFolderController", () => {
  let controller, worker;
  const requestId = "request-id";
  beforeEach(() => {
    jest.clearAllMocks();
    worker = { port: { emit: jest.fn() } };
    controller = new UpdateFolderController(worker, requestId, defaultApiClientOptions());
  });
  describe("::exec", () => {
    it("builds a folder entity from the dto, updates it and returns the updated folder entity", async () => {
      expect.assertions(3);
      const folderId = uuidv4();
      const folderDto = defaultFolderDto({ id: folderId, name: "Updated name" });
      const updatedFolder = new FolderEntity(folderDto);
      jest.spyOn(controller.updateFolderService, "update").mockResolvedValue(updatedFolder);

      const result = await controller.exec(folderDto);
      expect(controller.updateFolderService.update).toHaveBeenCalledTimes(1);
      expect(controller.updateFolderService.update).toHaveBeenCalledWith(new FolderEntity(folderDto));
      expect(result).toStrictEqual(updatedFolder);
    });
    it("throws an EntityValidationError and does not call the service if the folder dto is not valid", async () => {
      expect.assertions(2);
      jest.spyOn(controller.updateFolderService, "update");
      await expect(() => controller.exec({})).toThrowEntityValidationError("name", "required");
      expect(controller.updateFolderService.update).not.toHaveBeenCalled();
    });
  });
  describe("::_exec", () => {
    it("emits SUCCESS with the update folder when the update succeds.", async () => {
      expect.assertions(2);
      const folderDto = defaultFolderDto({ name: "Updated name" });
      const updatedFolder = new FolderEntity(folderDto);
      jest.spyOn(controller, "exec").mockResolvedValue(updatedFolder);
      await controller._exec(folderDto);
      expect(controller.exec).toHaveBeenCalledWith(folderDto);
      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "SUCCESS", updatedFolder);
    });
    it("emits ERROR and logs the error when the update fails.", async () => {
      expect.assertions(2);
      const error = new Error("Unable to update the folder.");
      jest.spyOn(controller, "exec").mockRejectedValue(error);
      jest.spyOn(console, "error").mockImplementation(() => {});
      await controller._exec(defaultFolderDto());
      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "ERROR", error);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });
});
