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

import DeleteFolderService from "./deleteFolderService";
import FolderApiService from "../api/folder/folderApiService";
import FolderLocalStorage from "../local_storage/folderLocalStorage";
import FindAndUpdateFoldersLocalStorageService from "./findAndUpdateFoldersLocalStorageService";
import FindAndUpdateResourcesLocalStorageService from "../resource/findAndUpdateResourcesLocalStorageService";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { v4 as uuidv4 } from "uuid";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DeleteFolderService", () => {
  let service, callOrder, apiDeleteMock, localStorageDeleteMock, foldersRefreshMock, resourcesRefreshMock;

  beforeEach(() => {
    const account = new AccountEntity(defaultAccountDto());
    const apiClientOptions = defaultApiClientOptions();
    service = new DeleteFolderService(account, apiClientOptions);
    callOrder = [];
    apiDeleteMock = jest.spyOn(FolderApiService.prototype, "delete").mockImplementation(() => {
      callOrder.push("api");
    });

    localStorageDeleteMock = jest.spyOn(FolderLocalStorage, "delete").mockImplementation(() => {
      callOrder.push("folderLocalStorage");
    });
    foldersRefreshMock = jest
      .spyOn(FindAndUpdateFoldersLocalStorageService.prototype, "findAndUpdateAll")
      .mockImplementation(() => {
        callOrder.push("foldersRefresh");
      });
    resourcesRefreshMock = jest
      .spyOn(FindAndUpdateResourcesLocalStorageService.prototype, "findAndUpdateAll")
      .mockImplementation(() => {
        callOrder.push("resourcesRefresh");
      });
  });

  describe("::delete", () => {
    it("deletes without cascade: API call, folders local storage delete, then resources refresh only.", async () => {
      expect.assertions(5);
      const folderId = uuidv4();

      await service.delete(folderId, false);

      expect(apiDeleteMock).toHaveBeenCalledWith(folderId, false);
      expect(localStorageDeleteMock).toHaveBeenCalledWith(folderId);
      expect(foldersRefreshMock).not.toHaveBeenCalled();
      expect(resourcesRefreshMock).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(["api", "folderLocalStorage", "resourcesRefresh"]);
    });

    it("deletes with cascade: refreshes the folders local storage before the resources one.", async () => {
      expect.assertions(3);
      const folderId = uuidv4();

      await service.delete(folderId, true);

      expect(apiDeleteMock).toHaveBeenCalledWith(folderId, true);
      expect(resourcesRefreshMock).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(["api", "folderLocalStorage", "foldersRefresh", "resourcesRefresh"]);
    });

    it("defaults cascade to false.", async () => {
      expect.assertions(2);
      const folderId = uuidv4();

      await service.delete(folderId);

      expect(apiDeleteMock).toHaveBeenCalledWith(folderId, false);
      expect(foldersRefreshMock).not.toHaveBeenCalled();
    });

    it("does not touch any local storage if the API call fails.", async () => {
      expect.assertions(4);
      const error = new Error("API error");
      apiDeleteMock.mockImplementation(() => {
        throw error;
      });

      await expect(service.delete(uuidv4(), true)).rejects.toThrow(error);

      expect(localStorageDeleteMock).not.toHaveBeenCalled();
      expect(foldersRefreshMock).not.toHaveBeenCalled();
      expect(resourcesRefreshMock).not.toHaveBeenCalled();
    });

    it("throws if the folder id is not a valid uuid.", async () => {
      expect.assertions(2);

      await expect(service.delete("not-a-uuid")).rejects.toThrow("The folder id should be a valid uuid.");
      expect(apiDeleteMock).not.toHaveBeenCalled();
    });

    it("throws if cascade is not a boolean.", async () => {
      expect.assertions(2);

      await expect(service.delete(uuidv4(), "yes")).rejects.toThrow(TypeError);
      expect(apiDeleteMock).not.toHaveBeenCalled();
    });
  });
});
