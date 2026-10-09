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

import FolderApiService from "../api/folder/folderApiService";
import FolderLocalStorage from "../local_storage/folderLocalStorage";
import FolderEntity from "../../model/entity/folder/folderEntity";
import { assertType } from "../../utils/assertions";

/**
 * The service aims to update a folder
 */
export default class UpdateFolderService {
  /**
   * @constructor
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(apiClientOptions) {
    this.folderService = new FolderApiService(apiClientOptions);
  }

  /**
   * Update a folder using Passbolt API and reflect in local storage
   * @param {FolderEntity} folderEntity The folder entity to update, identified by its id
   * @return {Promise<FolderEntity>} The updated folder entity
   * @throws {TypeError} if the folderEntity arguments is not of type FolderEntity
   * @throws {Error} if the folder does not exist in the local storage
   */
  async update(folderEntity) {
    assertType(folderEntity, FolderEntity);
    const folderDto = await this.folderService.update(folderEntity.id, folderEntity.toDto(), { permission: true });
    const updatedFolderEntity = new FolderEntity(folderDto);
    await FolderLocalStorage.updateFolder(updatedFolderEntity);

    return updatedFolderEntity;
  }
}
