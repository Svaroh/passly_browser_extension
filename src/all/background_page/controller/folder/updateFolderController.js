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
import FolderEntity from "../../model/entity/folder/folderEntity";
import UpdateFolderService from "../../service/folder/updateFolderService";

class UpdateFolderController {
  /**
   * Constructor
   *
   * @param {Worker} worker The associated worker
   * @param {string} requestId The associated request id
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(worker, requestId, apiClientOptions) {
    this.worker = worker;
    this.requestId = requestId;
    this.updateFolderService = new UpdateFolderService(apiClientOptions);
  }
  /**
   * Controller executor.
   * @param {object} folderdTO The folder datatransfer object
   * @returns {Promise<void>}
   */
  async _exec(folderDto) {
    try {
      const result = await this.exec(folderDto);
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }
  /**
   * Update a folder
   * @param {object} folderDto The folder data transfer object
   * @returns {Promise<FolderEntity>}
   * @throws {TypeError} if the folderDto does not validate folder entity schema
   */
  async exec(folderDto) {
    const folderEntity = new FolderEntity(folderDto);
    return this.updateFolderService.update(folderEntity);
  }
}
export default UpdateFolderController;
