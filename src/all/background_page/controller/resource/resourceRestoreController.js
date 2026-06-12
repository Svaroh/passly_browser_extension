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
 * @since         6.0.1
 */
import RestoreResourceService from "../../service/resource/restore/restoreResourceService";
import ProgressService from "../../service/progress/progressService";
import i18n from "../../sdk/i18n";

class ResourceRestoreController {
  /**
   * ResourceRestoreController constructor
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions the api client options
   * @param {AccountEntity} account The account associated to the worker.clientOptions
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.progressService = new ProgressService(this.worker, i18n.t("Restore Resources"));
    this.resourceRestoreService = new RestoreResourceService(account, apiClientOptions, this.progressService);
  }

  /**
   * Controller executor.
   * @param {Array<string>} resourceIds The resourceIds to restore
   * @returns {Promise<void>}
   */
  async _exec(resourceIds) {
    try {
      const resources = await this.exec(resourceIds);
      this.worker.port.emit(this.requestId, "SUCCESS", resources);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Restore resources.
   * @param {Array<string>} resourceIds The resourceIds
   * @returns {Promise<Array<object>>}
   */
  async exec(resourceIds) {
    const steps = 2;
    this.progressService.title = i18n.t("Restore {{count}} resource(s)", { count: resourceIds.length });
    this.progressService.start(steps, i18n.t("Restoring Resource(s)"));

    try {
      const resources = await this.resourceRestoreService.restoreResources(resourceIds);
      this.progressService.finishStep(i18n.t("Done!"), true);

      return resources;
    } finally {
      this.progressService.close();
    }
  }
}

export default ResourceRestoreController;
