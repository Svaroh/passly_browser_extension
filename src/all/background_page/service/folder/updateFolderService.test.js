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
 * @since         5.15.0
 */

import { v4 as uuidv4 } from "uuid";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultFolderDto } from "passbolt-styleguide/src/shared/models/entity/folder/folderEntity.test.data";
import UpdateFolderService from "./updateFolderService";
import FolderEntity from "../../model/entity/folder/folderEntity";
import FolderLocalStorage from "../local_storage/folderLocalStorage";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("UpdateFolderService", () => {
  let service;

  beforeEach(() => {
    service = new UpdateFolderService(defaultApiClientOptions());
  });

  describe("::update", () => {
    it("updates a folder using the API and reflect the change in the local storage", async () => {
      expect.assertions(6);
      const folderId = uuidv4();
      const folderToUpdate = new FolderEntity(defaultFolderDto({ id: folderId, name: "Original Name" }));
      const apiFolderDto = defaultFolderDto({ id: folderId, name: "Updated Name" });

      jest.spyOn(service.folderService, "update").mockResolvedValue(apiFolderDto);
      jest.spyOn(FolderLocalStorage, "updateFolder").mockImplementation(() => {});

      const updatedFolder = await service.update(folderToUpdate);

      expect(service.folderService.update).toHaveBeenCalledTimes(1);
      expect(service.folderService.update).toHaveBeenCalledWith(folderToUpdate.id, folderToUpdate.toDto(), {
        permission: true,
      });
      expect(updatedFolder).toBeInstanceOf(FolderEntity);
      expect(updatedFolder.toDto()).toEqual(new FolderEntity(apiFolderDto).toDto());
      expect(FolderLocalStorage.updateFolder).toHaveBeenCalledTimes(1);
      expect(FolderLocalStorage.updateFolder).toHaveBeenCalledWith(updatedFolder);
    });

    it("throws a TypeError if the folder entity is not of type FolderEntity", async () => {
      expect.assertions(3);
      jest.spyOn(service.folderService, "update");
      jest.spyOn(FolderLocalStorage, "updateFolder");

      await expect(service.update({})).rejects.toThrow(TypeError);

      expect(service.folderService.update).not.toHaveBeenCalled();
      expect(FolderLocalStorage.updateFolder).not.toHaveBeenCalled();
    });

    it("does not update the local storage if the api call fails.", async () => {
      const folderToUpdate = new FolderEntity(defaultFolderDto());
      const error = new Error("The Passbolt API is not reachable");

      jest.spyOn(service.folderService, "update").mockRejectedValue(error);
      jest.spyOn(FolderLocalStorage, "updateFolder");

      await expect(service.update(folderToUpdate)).rejects.toThrow(error.message);
      expect(FolderLocalStorage.updateFolder).not.toHaveBeenCalled();
    });
  });
});
