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

import FolderApiService from "../api/folder/folderApiService";
import FolderLocalStorage from "../local_storage/folderLocalStorage";
import FindAndUpdateFoldersLocalStorageService from "./findAndUpdateFoldersLocalStorageService";
import FindAndUpdateResourcesLocalStorageService from "../resource/findAndUpdateResourcesLocalStorageService";
import { assertBoolean, assertUuid } from "../../utils/assertions";

/**
 * The service aims to delete a folder
 */
export default class DeleteFolderService {
  /**
   * @constructor
   * @param {ApiClientOptions} apiClientOptions The api client options
   * @param {AccountEntity} account The user account
   */
  constructor(apiClientOptions, account) {
    this.folderService = new FolderApiService(apiClientOptions);
    this.findAndUpdateFoldersLocalStorageService = new FindAndUpdateFoldersLocalStorageService(
      account,
      apiClientOptions,
    );
    this.findAndUpdateResourcesLocalStorageService = new FindAndUpdateResourcesLocalStorageService(
      account,
      apiClientOptions,
    );
  }

  /**
   * Delete a folder
   *
   * Without cascade, the API moves the folder direct content (sub-folders and resources) to the root.
   * With cascade, the API deletes every descendant the user is allowed to delete and moves the others
   * to the root; the set of impacted descendants is only known server side, hence the full folders
   * local storage refresh in that case
   *
   * @param {string} folderId the folder's id
   * @param {boolean} [cascade = false] delete sub folder / folders
   * @returns {Promise<void>}
   */
  async delete(folderId, cascade = false) {
    assertUuid(folderId, "The folder id should be a valid uuid.");
    assertBoolean(cascade, "The cascade parameter should be a boolean.");

    await this.folderService.delete(folderId, cascade);
    await FolderLocalStorage.delete(folderId);
    if (cascade) {
      /*
       * update storage and get updated sub folders list in case some are deleted
       * TODO: optimize update only if folder contains subfolders
       */
      await this.findAndUpdateFoldersLocalStorageService.findAndUpdateAll();
    }
    await this.findAndUpdateResourcesLocalStorageService.findAndUpdateAll();
  }
}
